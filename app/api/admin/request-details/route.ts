import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { serviceRequests } from "../../../../db/schema";
import { getAdminApiUser } from "../../../admin-access";
import { createNotification, notifyClient } from "../../../notification-service";
import { artisanApplications } from "../../../../db/schema";

const commissionStatuses = ["not_applicable", "due", "collected", "waived"];

export async function PATCH(request: Request) {
  if (!(await getAdminApiUser())) return Response.json({ error: "Accès refusé" }, { status: 403 });
  const body = (await request.json()) as { id?: number; assignedArtisan?: string; commissionAmount?: number; commissionStatus?: string };
  const id = Number(body.id);
  const commissionAmount = Number(body.commissionAmount ?? 0);
  const commissionStatus = body.commissionStatus ?? "not_applicable";
  if (!Number.isInteger(id) || id < 1 || !Number.isInteger(commissionAmount) || commissionAmount < 0 || commissionAmount > 3000 || !commissionStatuses.includes(commissionStatus)) {
    return Response.json({ error: "Informations invalides" }, { status: 400 });
  }
  const db = getDb();
  const assignedArtisan = body.assignedArtisan?.trim().slice(0, 100) || null;
  const [current] = await db.select({ assignedArtisan: serviceRequests.assignedArtisan }).from(serviceRequests).where(eq(serviceRequests.id, id)).limit(1);
  const assignmentChanged = current?.assignedArtisan !== assignedArtisan;
  await db.update(serviceRequests).set({
    assignedArtisan,
    commissionAmount,
    commissionStatus,
    ...(assignmentChanged ? { status: assignedArtisan ? "assigned" : "new", expertDecision: "pending", rejectionReason: null, quoteAmount: 0, laborAmount: 0, materialAmount: 0, quoteDetails: null, quoteStatus: "not_sent", scheduledFor: null } : {}),
    updatedAt: new Date(),
  }).where(eq(serviceRequests.id, id));
  if (assignmentChanged && assignedArtisan) {
    const [expert] = await db.select({ id: artisanApplications.id }).from(artisanApplications).where(eq(artisanApplications.name, assignedArtisan)).limit(1);
    await notifyClient(id, "expert_assigned", "Expert affecté", `${assignedArtisan} a été choisi pour votre demande.`);
    if (expert) await createNotification({ requestId: id, recipientType: "expert", recipientId: expert.id, kind: "new_mission", title: "Nouvelle mission", body: "Une nouvelle demande vous a été affectée. Consultez-la et répondez rapidement." });
  }
  return Response.json({ ok: true });
}
