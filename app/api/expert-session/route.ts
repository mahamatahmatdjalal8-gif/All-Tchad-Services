import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { expertSessions } from "../../../db/schema";
import { hashToken } from "../../access-security";
import { EXPERT_SESSION_COOKIE } from "../../social-auth";

export async function POST() {
  return Response.json({ error: "La connexion par numéro ART a été remplacée par le compte personnel.", requiresAccount: true }, { status: 410 });
}

export async function DELETE() {
  const store = await cookies();
  const token = store.get(EXPERT_SESSION_COOKIE)?.value;
  if (token) await getDb().delete(expertSessions).where(eq(expertSessions.tokenHash, await hashToken(token)));
  store.delete(EXPERT_SESSION_COOKIE);
  return Response.json({ ok: true });
}
