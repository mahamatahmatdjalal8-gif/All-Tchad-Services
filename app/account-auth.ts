import { cookies } from "next/headers";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { artisanApplications, personalAccounts, personalSessions, serviceRequests } from "../db/schema";
import { hashToken } from "./access-security";
import { createTrackingReference } from "./tracking-reference";

export const PERSONAL_SESSION_COOKIE = "ats_personal_session";

export function normalizePhone(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("235") && digits.length === 11) return `+${digits}`;
  if (digits.length === 8) return `+235${digits}`;
  return raw.startsWith("+") ? `+${digits}` : digits;
}

export async function createPersonalSession(accountId: number) {
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  await getDb().insert(personalSessions).values({ accountId, tokenHash: await hashToken(token) });
  const store = await cookies();
  store.set(PERSONAL_SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  // Une nouvelle connexion personnelle ne doit jamais réutiliser les anciens
  // accès de test basés sur une référence ATS ou ART.
  store.delete("ats_client_session");
  store.delete("ats_expert_session");
}

export async function getPersonalContext() {
  const token = (await cookies()).get(PERSONAL_SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  const [row] = await db.select({ account: personalAccounts, sessionId: personalSessions.id })
    .from(personalSessions)
    .innerJoin(personalAccounts, eq(personalSessions.accountId, personalAccounts.id))
    .where(eq(personalSessions.tokenHash, await hashToken(token)))
    .limit(1);
  if (!row) return null;
  let [application] = await db.select().from(artisanApplications).where(eq(artisanApplications.accountId, row.account.id)).orderBy(desc(artisanApplications.createdAt)).limit(1);
  if (!application) {
    try {
      [application] = await db.insert(artisanApplications).values({
        accountId: row.account.id,
        reference: createTrackingReference("ART"),
        name: row.account.name,
        phone: row.account.phone,
        trade: "Compte privé",
        area: row.account.city,
        coverage: row.account.city,
        experience: 0,
        availability: "Non publié",
        proof: "À compléter lors de la candidature",
        workExamples: "À compléter lors de la candidature",
        status: "account_only",
      }).returning();
    } catch {
      [application] = await db.select().from(artisanApplications).where(eq(artisanApplications.accountId, row.account.id)).orderBy(desc(artisanApplications.createdAt)).limit(1);
    }
  }
  const [latestRequest] = await db.select().from(serviceRequests).where(eq(serviceRequests.accountId, row.account.id)).orderBy(desc(serviceRequests.createdAt)).limit(1);
  return { ...row, application: application ?? null, latestRequest: latestRequest ?? null };
}

export async function deletePersonalSession() {
  const store = await cookies();
  const token = store.get(PERSONAL_SESSION_COOKIE)?.value;
  if (token) await getDb().delete(personalSessions).where(and(eq(personalSessions.tokenHash, await hashToken(token))));
  store.delete(PERSONAL_SESSION_COOKIE);
}
