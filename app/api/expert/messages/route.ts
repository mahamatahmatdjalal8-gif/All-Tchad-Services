import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../../db";
import { requestMessages, serviceRequests } from "../../../../db/schema";
import { getExpertContext } from "../../../social-auth";
import { createNotification } from "../../../notification-service";
import { canSendMissionMessage, hasMissionConversation, isMissionParticipant, ownedServiceMissions, withoutAccessCode } from "../../../mission-access";

export async function GET() {
  const context = await getExpertContext();
  if (!context) return Response.json({ error: "Connectez-vous pour consulter vos discussions." }, { status: 401 });
  const db = getDb();
  const requests = await db.select().from(serviceRequests).where(ownedServiceMissions(context.expert.id)).orderBy(desc(serviceRequests.createdAt)).limit(200);
  const ids = requests.filter(hasMissionConversation).map((item) => item.id);
  const messages = ids.length ? await db.select().from(requestMessages).where(inArray(requestMessages.requestId, ids)).orderBy(desc(requestMessages.createdAt), desc(requestMessages.id)).limit(1000) : [];
  return Response.json({ requests: requests.map(withoutAccessCode), messages: messages.reverse() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const context = await getExpertContext();
  if (!context) return Response.json({ error: "Connectez-vous pour envoyer un message." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const requestId = Number(body.requestId);
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!Number.isInteger(requestId) || requestId < 1) return Response.json({ error: "Envoyez une demande de service. La conversation s’ouvrira après son acceptation." }, { status: 400 });
  if (content.length < 2 || content.length > 600) return Response.json({ error: "Le message doit contenir entre 2 et 600 caractères." }, { status: 400 });
  const db = getDb();
  const outcome = await db.transaction(async (tx) => {
    const [mission] = await tx.select().from(serviceRequests).where(eq(serviceRequests.id, requestId)).for("update").limit(1);
    if (!mission || !isMissionParticipant(mission, context.expert.id)) return { error: "Cette conversation ne vous appartient pas.", status: 403 } as const;
    if (!canSendMissionMessage(mission)) return { error: "La discussion est disponible après acceptation, jusqu’à la fin de la mission.", status: 409 } as const;
    const [message] = await tx.insert(requestMessages).values({ requestId, senderExpertId: context.expert.id, senderType: context.expert.status === "accepted" ? "expert" : "client", senderName: context.expert.name, body: content }).returning();
    return { message, recipientId: mission.requesterExpertId === context.expert.id ? mission.targetExpertId : mission.requesterExpertId };
  });
  if ("error" in outcome) return Response.json({ error: outcome.error }, { status: outcome.status });
  if (outcome.recipientId) {
    await createNotification({ requestId, recipientType: "expert", recipientId: outcome.recipientId, kind: "mission_message", title: `Message de ${context.expert.name}`, body: content.slice(0, 140) }).catch(() => console.error("Message notification unavailable."));
  }
  return Response.json({ message: outcome.message }, { status: 201 });
}
