import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { artisanApplications, feedbackEntries, serviceRequests } from "../../../../db/schema";
import { getAdminApiUser } from "../../../admin-access";

const allowed: Record<string, string[]> = {
  request: ["new", "assigned", "in_progress", "completed", "cancelled"],
  artisan: ["pending", "accepted", "rejected", "suspended"],
  feedback: ["open", "in_review", "resolved"],
};

export async function PATCH(request: Request) {
  if (!(await getAdminApiUser())) return Response.json({ error: "Accès refusé" }, { status: 403 });

  const body = (await request.json()) as { type?: string; id?: number; status?: string; note?: string };
  const type = body.type ?? "";
  const id = Number(body.id);
  const status = body.status ?? "";
  if (!allowed[type]?.includes(status) || !Number.isInteger(id) || id < 1) {
    return Response.json({ error: "Mise à jour invalide" }, { status: 400 });
  }

  const db = getDb();
  const updatedAt = new Date();
  if (type === "request") await db.update(serviceRequests).set({ status, updatedAt }).where(eq(serviceRequests.id, id));
  if (type === "artisan") {
    if (status === "accepted") {
      const [application] = await db.select({
        name: artisanApplications.name,
        phone: artisanApplications.phone,
        trade: artisanApplications.trade,
        area: artisanApplications.area,
        coverage: artisanApplications.coverage,
        availability: artisanApplications.availability,
        identityType: artisanApplications.identityType,
        identityNumber: artisanApplications.identityNumber,
        workshopAddress: artisanApplications.workshopAddress,
      }).from(artisanApplications).where(eq(artisanApplications.id, id)).limit(1);
      const textComplete = application && Object.values(application).every((value) => typeof value === "string" && value.trim().length > 0);
      const nniValid = application && /^\d{10}$/.test(application.identityNumber ?? "");
      if (!textComplete || !nniValid) {
        return Response.json({ error: "Acceptation impossible : les informations du profil et un NNI valide de 10 chiffres sont obligatoires." }, { status: 409 });
      }
    }
    await db.update(artisanApplications).set({ status, reviewNote: body.note?.trim().slice(0, 500) || null, updatedAt }).where(eq(artisanApplications.id, id));
  }
  if (type === "feedback") await db.update(feedbackEntries).set({ status, updatedAt }).where(eq(feedbackEntries.id, id));

  return Response.json({ ok: true, id, type, status });
}
