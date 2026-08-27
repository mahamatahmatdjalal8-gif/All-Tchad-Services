import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { artisanApplications, expertCredentials, expertSessions } from "../../../../db/schema";
import { getAdminApiUser } from "../../../admin-access";
import { hashAccessCode } from "../../../access-security";

export async function PATCH(request: Request) {
  if (!(await getAdminApiUser())) return Response.json({ error: "Accès refusé" }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { id?: number; loginEmail?: string; accessCode?: string };
  const id = Number(body.id);
  const loginEmail = body.loginEmail?.trim().toLowerCase().slice(0, 180) ?? "";
  const accessCode = body.accessCode?.trim() ?? "";
  if (!Number.isInteger(id) || id < 1 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)) return Response.json({ error: "Adresse e-mail invalide." }, { status: 400 });
  if (!/^\d{6}$/.test(accessCode)) return Response.json({ error: "Choisissez un code d’accès de 6 chiffres." }, { status: 400 });
  const db = getDb();
  const [expert] = await db.select({ id: artisanApplications.id, status: artisanApplications.status }).from(artisanApplications).where(eq(artisanApplications.id, id)).limit(1);
  if (!expert || expert.status !== "accepted") return Response.json({ error: "Acceptez d’abord la candidature." }, { status: 409 });
  await db.update(artisanApplications).set({ loginEmail, updatedAt: new Date() }).where(eq(artisanApplications.id, id));
  await db.delete(expertCredentials).where(eq(expertCredentials.expertId, id));
  await db.delete(expertSessions).where(eq(expertSessions.expertId, id));
  await db.insert(expertCredentials).values({ expertId: id, email: loginEmail, codeHash: await hashAccessCode(accessCode) });
  return Response.json({ ok: true, loginEmail });
}
