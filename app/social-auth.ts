import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { artisanApplications, expertSessions } from "../db/schema";
import { getPersonalContext } from "./account-auth";

export const EXPERT_SESSION_COOKIE = "ats_expert_session";

export async function hashSessionToken(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function getExpertContext() {
  const personal = await getPersonalContext();
  if (personal?.application) return { user: { email: personal.application.loginEmail || personal.account.phone }, expert: personal.application, account: personal.account };
  if (personal) return null;
  const token = (await cookies()).get(EXPERT_SESSION_COOKIE)?.value;
  if (!token) return null;
  const [expert] = await getDb().select().from(artisanApplications).innerJoin(expertSessions, eq(expertSessions.expertId, artisanApplications.id)).where(and(eq(expertSessions.tokenHash, await hashSessionToken(token)), eq(artisanApplications.status, "accepted"))).limit(1);
  return expert ? { user: { email: expert.artisan_applications.loginEmail || "" }, expert: expert.artisan_applications } : null;
}

export async function getSocialActor() {
  const expert = await getExpertContext();
  if (expert) return { kind: "expert" as const, expertId: expert.expert.id, name: expert.expert.name, phone: expert.expert.phone, expert: expert.expert };
  return null;
}
