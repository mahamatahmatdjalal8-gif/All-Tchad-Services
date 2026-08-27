import { and, eq, isNull, or } from "drizzle-orm";
import { getDb } from "../../../../db";
import { requestMessages, serviceRequests } from "../../../../db/schema";
import { getExpertContext } from "../../../social-auth";
import { createNotification, notifyClient } from "../../../notification-service";

const clean = (value: unknown, max = 600) => typeof value === "string" ? value.trim().slice(0, max) : "";
const allowedActions = new Set(["accept", "decline", "quote", "confirm_quote", "arrive", "start", "complete"]);

export async function PATCH(request: Request) {
  const context = await getExpertContext();
  if (!context) return Response.json({ error: "Accès expert refusé." }, { status: 403 });
  if (context.expert.status !== "accepted") return Response.json({ error: "Votre candidature doit être acceptée avant de recevoir et gérer des missions." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const id = Number(body.id);
  const action = clean(body.action, 30);
  if (!Number.isInteger(id) || id < 1 || !allowedActions.has(action)) return Response.json({ error: "Action invalide." }, { status: 400 });
  const db = getDb();
  const [mission] = await db.select().from(serviceRequests).where(and(eq(serviceRequests.id, id), eq(serviceRequests.requestKind, "service"), or(eq(serviceRequests.targetExpertId, context.expert.id), and(isNull(serviceRequests.targetExpertId), eq(serviceRequests.assignedArtisan, context.expert.name))))).limit(1);
  if (!mission) return Response.json({ error: "Cette demande ne vous est pas attribuée." }, { status: 404 });

  const notifyRequester = async (kind: string, title: string, body: string) => {
    if (mission.requesterExpertId) {
      await createNotification({ requestId: id, recipientType: "expert", recipientId: mission.requesterExpertId, kind, title, body });
    } else await notifyClient(id, kind, title, body);
  };

  const updatedAt = new Date();
  let message = "";
  if (action === "accept") {
    await db.update(serviceRequests).set({ expertDecision: "accepted", rejectionReason: null, status: "assigned", updatedAt }).where(eq(serviceRequests.id, id));
    message = `${context.expert.name} a accepté votre demande. Un devis va vous être proposé.`;
    await notifyRequester("mission_accepted", "Demande acceptée", message);
  }
  if (action === "decline") {
    const reason = clean(body.reason, 300);
    if (reason.length < 3) return Response.json({ error: "Indiquez brièvement la raison du refus." }, { status: 400 });
    await db.update(serviceRequests).set({ expertDecision: "declined", rejectionReason: reason, status: mission.requesterExpertId ? "cancelled" : "new", updatedAt }).where(eq(serviceRequests.id, id));
    if (mission.requesterExpertId) {
      message = `${context.expert.name} ne peut pas accepter cette demande : ${reason}`;
      await notifyRequester("mission_declined", "Demande refusée", message);
    }
  }
  if (action === "quote") {
    if (mission.expertDecision !== "accepted") return Response.json({ error: "Acceptez d’abord la mission." }, { status: 409 });
    const laborAmount = Number(body.laborAmount ?? 0), materialAmount = Number(body.materialAmount ?? 0);
    const quoteDetails = clean(body.quoteDetails, 600), materialsNeeded = clean(body.materialsNeeded, 500), scheduledFor = clean(body.scheduledFor, 40);
    if (![laborAmount, materialAmount].every((value) => Number.isInteger(value) && value >= 0 && value <= 50_000_000) || laborAmount + materialAmount < 1) return Response.json({ error: "Montants du devis invalides." }, { status: 400 });
    if (quoteDetails.length < 5) return Response.json({ error: "Décrivez ce qui est compris dans le prix." }, { status: 400 });
    if (scheduledFor && Number.isNaN(Date.parse(scheduledFor))) return Response.json({ error: "Date d’intervention invalide." }, { status: 400 });
    const quoteAmount = laborAmount + materialAmount;
    await db.update(serviceRequests).set({ laborAmount, materialAmount, quoteAmount, quoteDetails, materialsNeeded: materialsNeeded || null, scheduledFor: scheduledFor || null, quoteStatus: "pending", updatedAt }).where(eq(serviceRequests.id, id));
    message = `${context.expert.name} vous propose un devis de ${quoteAmount.toLocaleString("fr-FR")} FCFA. Consultez-le et donnez votre accord ${mission.requesterExpertId ? "dans la messagerie" : "dans le suivi"}.`;
    await notifyRequester("quote_received", "Nouveau devis reçu", message);
  }
  if (action === "confirm_quote") {
    if (mission.requesterExpertId) return Response.json({ error: "L’expert demandeur doit accepter le devis dans la messagerie." }, { status: 409 });
    if (mission.expertDecision !== "accepted" || mission.quoteStatus !== "pending") return Response.json({ error: "Envoyez d’abord le devis." }, { status: 409 });
    await db.update(serviceRequests).set({ quoteStatus: "accepted", updatedAt }).where(eq(serviceRequests.id, id));
    message = "L’expert confirme avoir reçu l’accord du client par téléphone ou WhatsApp.";
  }
  if (action === "arrive") {
    if (mission.expertDecision !== "accepted" || mission.quoteStatus !== "accepted") return Response.json({ error: "Le devis doit être accepté avant d’annoncer votre arrivée." }, { status: 409 });
    await db.update(serviceRequests).set({ arrivedAt: updatedAt, updatedAt }).where(eq(serviceRequests.id, id));
    message = `${context.expert.name} indique être arrivé sur le lieu de l’intervention.`;
    await notifyRequester("expert_arrived", "Votre expert est arrivé", message);
  }
  if (action === "start") {
    if (mission.expertDecision !== "accepted" || mission.quoteStatus !== "accepted") return Response.json({ error: "Le client doit d’abord accepter le devis." }, { status: 409 });
    await db.update(serviceRequests).set({ status: "in_progress", updatedAt }).where(eq(serviceRequests.id, id));
    message = `${context.expert.name} a indiqué que l’intervention a commencé.`;
    await notifyRequester("work_started", "Intervention commencée", message);
  }
  if (action === "complete") {
    if (mission.status !== "in_progress") return Response.json({ error: "Démarrez l’intervention avant de la terminer." }, { status: 409 });
    await db.update(serviceRequests).set({ status: "completed", completedAt: updatedAt, commissionStatus: mission.commissionAmount > 0 ? "due" : "not_applicable", updatedAt }).where(eq(serviceRequests.id, id));
    message = mission.requesterExpertId ? `L’intervention de ${context.expert.name} est déclarée terminée.` : `L’intervention est déclarée terminée. Vous pouvez maintenant noter ${context.expert.name}.`;
    await notifyRequester("work_completed", "Intervention terminée", message);
  }
  let createdMessage = null;
  if (message) [createdMessage] = await db.insert(requestMessages).values({ requestId: id, senderType: "system", senderName: "Allô Tchad", body: message }).returning();
  const [updated] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, id)).limit(1);
  return Response.json({ request: updated, message: createdMessage });
}
