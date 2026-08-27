import { and, asc, desc, eq, isNotNull, isNull, or } from "drizzle-orm";
import { getDb } from "../../../../db";
import { artisanApplications, requestMessages, serviceRequests } from "../../../../db/schema";
import { getExpertContext } from "../../../social-auth";
import { createNotification } from "../../../notification-service";
import { createTrackingReference } from "../../../tracking-reference";

const clean = (value: unknown, max = 600) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function GET() {
  const context = await getExpertContext();
  if (!context) return Response.json({ error: "Accès expert refusé." }, { status: 403 });
  const ownership = or(eq(serviceRequests.requesterExpertId, context.expert.id), eq(serviceRequests.targetExpertId, context.expert.id), and(isNull(serviceRequests.targetExpertId), eq(serviceRequests.assignedArtisan, context.expert.name)));
  const requests = await getDb().select().from(serviceRequests).where(and(isNotNull(serviceRequests.requesterExpertId), ownership)).orderBy(asc(serviceRequests.createdAt)).limit(100);
  const requestIds = new Set(requests.map((item) => item.id));
  const allMessages = await getDb().select().from(requestMessages).orderBy(asc(requestMessages.createdAt)).limit(1000);
  return Response.json({ requests, messages: allMessages.filter((message) => requestIds.has(message.requestId)) });
}

export async function POST(request: Request) {
  const context = await getExpertContext();
  if (!context) return Response.json({ error: "Accès expert refusé." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const requestId = Number(body.requestId);
  const content = clean(body.content);
  const targetExpertId = Number(body.targetExpertId);
  if (content.length < 2) return Response.json({ error: "Message invalide." }, { status: 400 });
  const db = getDb();
  if ((!Number.isInteger(requestId) || requestId < 1) && Number.isInteger(targetExpertId) && targetExpertId > 0) {
    if (targetExpertId === context.expert.id) return Response.json({ error: "Choisissez un autre profil." }, { status: 409 });
    const [target] = await db.select().from(artisanApplications).where(eq(artisanApplications.id, targetExpertId)).limit(1);
    if (!target) return Response.json({ error: "Profil introuvable." }, { status: 404 });
    const [recent] = await db.select({ createdAt: serviceRequests.createdAt }).from(serviceRequests).where(and(eq(serviceRequests.requestKind, "conversation"), eq(serviceRequests.requesterExpertId, context.expert.id), eq(serviceRequests.targetExpertId, targetExpertId))).orderBy(desc(serviceRequests.createdAt)).limit(1);
    if (recent?.createdAt && Date.now() - new Date(recent.createdAt).getTime() < 30 * 1000) return Response.json({ error: "Cette conversation vient déjà d’être créée." }, { status: 429 });
    const accountId = "account" in context && context.account ? context.account.id : null;
    const [conversation] = await db.insert(serviceRequests).values({ accountId, requesterExpertId: context.expert.id, targetExpertId, requestKind: "conversation", reference: createTrackingReference("MSG"), customerName: context.expert.name, customerPhone: context.expert.phone, service: "Discussion privée", city: context.expert.area, district: target.area, urgency: "Normal", details: content, status: "assigned", assignedArtisan: target.name, expertDecision: "accepted" }).returning();
    const [message] = await db.insert(requestMessages).values({ requestId: conversation.id, senderExpertId: context.expert.id, senderType: "expert", senderName: context.expert.name, body: content }).returning();
    await createNotification({ requestId: conversation.id, recipientType: "expert", recipientId: target.id, kind: "expert_message", title: `Message de ${context.expert.name}`, body: content.slice(0, 140) });
    return Response.json({ request: conversation, message }, { status: 201 });
  }
  if (!Number.isInteger(requestId) || requestId < 1) return Response.json({ error: "Conversation invalide." }, { status: 400 });
  const [mission] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, requestId)).limit(1);
  const isProvider = mission?.targetExpertId === context.expert.id || (!mission?.targetExpertId && mission?.assignedArtisan === context.expert.name);
  const isRequester = mission?.requesterExpertId === context.expert.id;
  if (!mission?.requesterExpertId || (!isProvider && !isRequester)) return Response.json({ error: "Cette conversation professionnelle ne vous appartient pas." }, { status: 403 });
  const [message] = await db.insert(requestMessages).values({ requestId, senderExpertId: context.expert.id, senderType: "expert", senderName: context.expert.name, body: content }).returning();
  let recipientId = isRequester ? mission.targetExpertId : mission.requesterExpertId;
  if (isRequester && !recipientId && mission.assignedArtisan) {
    const [provider] = await db.select({ id: artisanApplications.id }).from(artisanApplications).where(eq(artisanApplications.name, mission.assignedArtisan)).limit(1);
    recipientId = provider?.id ?? null;
  }
  if (recipientId) await createNotification({ requestId, recipientType: "expert", recipientId, kind: "expert_message", title: `Message de ${context.expert.name}`, body: content.slice(0, 140) });
  return Response.json({ message }, { status: 201 });
}
