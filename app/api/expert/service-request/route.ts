import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { artisanApplications, requestMessages, serviceRequests } from "../../../../db/schema";
import { createNotification } from "../../../notification-service";
import { getExpertContext } from "../../../social-auth";
import { createTrackingReference } from "../../../tracking-reference";

const clean = (value: unknown, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(request: Request) {
  const context = await getExpertContext();
  if (!context) return Response.json({ error: "Connectez-vous comme expert pour envoyer une demande." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const targetExpertId = Number(body.targetExpertId);
  const details = clean(body.details, 800);
  const district = clean(body.district, 120) || context.expert.area;
  const urgency = clean(body.urgency, 30) || "Normal";
  if (!Number.isInteger(targetExpertId) || targetExpertId < 1 || details.length < 10) return Response.json({ error: "Décrivez précisément le service demandé." }, { status: 400 });
  if (targetExpertId === context.expert.id) return Response.json({ error: "Choisissez un autre expert." }, { status: 409 });
  const db = getDb();
  const [target] = await db.select().from(artisanApplications).where(and(eq(artisanApplications.id, targetExpertId), eq(artisanApplications.status, "accepted"))).limit(1);
  if (!target) return Response.json({ error: "Expert introuvable." }, { status: 404 });
  const [recent] = await db.select({ createdAt: serviceRequests.createdAt }).from(serviceRequests).where(and(eq(serviceRequests.customerPhone, context.expert.phone), eq(serviceRequests.assignedArtisan, target.name))).orderBy(desc(serviceRequests.createdAt)).limit(1);
  if (recent?.createdAt && Date.now() - new Date(recent.createdAt).getTime() < 2 * 60 * 1000) return Response.json({ error: "Une demande vient déjà d’être envoyée à cet expert. Patientez quelques instants." }, { status: 429 });
  const accountId = "account" in context && context.account ? context.account.id : null;
  const [mission] = await db.insert(serviceRequests).values({
    accountId,
    requesterExpertId: context.expert.id,
    targetExpertId: target.id,
    requestKind: "service",
    reference: createTrackingReference("PRO"),
    customerName: context.expert.name,
    customerPhone: context.expert.phone,
    service: target.trade,
    city: context.expert.area,
    district,
    urgency,
    details: `Demande professionnelle envoyée à ${target.name}.\n${details}`,
    status: "assigned",
    assignedArtisan: target.name,
    expertDecision: "pending",
  }).returning({ id: serviceRequests.id });
  await db.insert(requestMessages).values({ requestId: mission.id, senderExpertId: context.expert.id, senderType: "expert", senderName: context.expert.name, body: details });
  await createNotification({ requestId: mission.id, recipientType: "expert", recipientId: target.id, kind: "expert_service_request", title: "Demande d’un autre expert", body: `${context.expert.name} sollicite votre service : ${details.slice(0, 120)}` });
  return Response.json({ requestId: mission.id, targetName: target.name, conversationUrl: `/espace-expert?tab=messages&request=${mission.id}` }, { status: 201 });
}

export async function PATCH(request: Request) {
  const context = await getExpertContext();
  if (!context) return Response.json({ error: "Accès expert refusé." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const requestId = Number(body.requestId);
  const action = clean(body.action, 30);
  if (!Number.isInteger(requestId) || requestId < 1) return Response.json({ error: "Conversation invalide." }, { status: 400 });
  const db = getDb();
  const [mission] = await db.select().from(serviceRequests).where(and(eq(serviceRequests.id, requestId), eq(serviceRequests.requesterExpertId, context.expert.id))).limit(1);
  if (!mission) return Response.json({ error: "Cette demande ne vous appartient pas." }, { status: 403 });
  const updatedAt = new Date();
  let text = "";
  if (action === "accept_quote" || action === "reject_quote") {
    if (mission.quoteStatus !== "pending") return Response.json({ error: "Ce devis n’est plus en attente." }, { status: 409 });
    const quoteStatus = action === "accept_quote" ? "accepted" : "rejected";
    await db.update(serviceRequests).set({ quoteStatus, updatedAt }).where(eq(serviceRequests.id, requestId));
    text = action === "accept_quote" ? `Le devis de ${mission.quoteAmount.toLocaleString("fr-FR")} FCFA a été accepté.` : "Le devis a été refusé. Continuez la discussion pour trouver un accord.";
  } else if (action === "cancel") {
    if (["completed", "cancelled"].includes(mission.status)) return Response.json({ error: "Cette demande ne peut plus être annulée." }, { status: 409 });
    await db.update(serviceRequests).set({ status: "cancelled", cancellationReason: "Annulée par l’expert demandeur", updatedAt }).where(eq(serviceRequests.id, requestId));
    text = "La demande de service a été annulée par l’expert demandeur.";
  } else return Response.json({ error: "Action invalide." }, { status: 400 });
  const [message] = await db.insert(requestMessages).values({ requestId, senderType: "system", senderName: "Allô Tchad", body: text }).returning();
  if (mission.assignedArtisan) {
    const [provider] = await db.select({ id: artisanApplications.id }).from(artisanApplications).where(eq(artisanApplications.name, mission.assignedArtisan)).limit(1);
    if (provider) await createNotification({ requestId, recipientType: "expert", recipientId: provider.id, kind: action, title: action === "accept_quote" ? "Devis accepté" : action === "reject_quote" ? "Devis refusé" : "Demande annulée", body: text });
  }
  const [updated] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, requestId)).limit(1);
  return Response.json({ request: updated, message });
}
