import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "../../../db";
import { artisanApplications, personalAccounts, personalSessions } from "../../../db/schema";
import { hashAccessCode, verifyAccessCode } from "../../access-security";
import { createPersonalSession, deletePersonalSession, getPersonalContext, normalizePhone, PERSONAL_SESSION_COOKIE } from "../../account-auth";

const clean = (value: unknown, max = 120) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function GET() {
  const context = await getPersonalContext();
  if (!context) return Response.json({ authenticated: false }, { status: 401 });
  const { account, application } = context;
  return Response.json({ authenticated: true, account: { id: account.id, name: account.name, phone: account.phone, city: account.city }, application: application ? { reference: application.reference, trade: application.trade, status: application.status, reviewNote: application.reviewNote } : null, expertMode: application?.status === "accepted" });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = clean(body.action, 20);
  const phone = normalizePhone(body.phone);
  const password = clean(body.password, 100);
  if (!/^\+235\d{8}$/.test(phone)) return Response.json({ error: "Entrez un numéro tchadien valide à 8 chiffres." }, { status: 400 });
  if (password.length < 6) return Response.json({ error: "Le mot de passe doit contenir au moins 6 caractères." }, { status: 400 });
  const db = getDb();
  const [existing] = await db.select().from(personalAccounts).where(eq(personalAccounts.phone, phone)).limit(1);

  if (action === "register") {
    const name = clean(body.name, 100);
    const city = clean(body.city, 80) || "N’Djamena";
    if (name.length < 3) return Response.json({ error: "Entrez votre nom complet." }, { status: 400 });
    if (existing) return Response.json({ error: "Ce numéro possède déjà un compte. Connectez-vous." }, { status: 409 });
    const [account] = await db.insert(personalAccounts).values({ name, phone, city, passwordHash: await hashAccessCode(password) }).returning();
    await createPersonalSession(account.id);
    return Response.json({ ok: true, account: { name: account.name, phone: account.phone }, next: "/espace-expert?tab=profile" }, { status: 201 });
  }

  if (action === "login") {
    if (!existing || !(await verifyAccessCode(password, existing.passwordHash))) return Response.json({ error: "Numéro ou mot de passe incorrect." }, { status: 401 });
    await createPersonalSession(existing.id);
    const [profile] = await db.select({ status: artisanApplications.status }).from(artisanApplications).where(eq(artisanApplications.accountId, existing.id)).limit(1);
    return Response.json({ ok: true, account: { name: existing.name, phone: existing.phone }, next: "/espace-expert?tab=profile", expertMode: profile?.status === "accepted" });
  }
  return Response.json({ error: "Action invalide." }, { status: 400 });
}

export async function DELETE() {
  await deletePersonalSession();
  return Response.json({ ok: true });
}

export async function PATCH() {
  const context = await getPersonalContext();
  if (!context) return Response.json({ error: "Session expirée." }, { status: 401 });
  const db = getDb();
  await db.delete(personalSessions).where(eq(personalSessions.accountId, context.account.id));
  (await cookies()).delete(PERSONAL_SESSION_COOKIE);
  return Response.json({ ok: true });
}
