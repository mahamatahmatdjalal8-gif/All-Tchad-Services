import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../../../db";
import { notifications } from "../../../db/schema";
import { getExpertContext } from "../../social-auth";

async function recipient() {
  const expert = await getExpertContext();
  if (expert) return { type: "expert", id: expert.expert.id } as const;
  return null;
}

export async function GET() {
  const owner = await recipient();
  if (!owner) return Response.json({ error: "Session expirée." }, { status: 401 });
  const rows = await getDb().select().from(notifications).where(and(eq(notifications.recipientType, owner.type), eq(notifications.recipientId, owner.id))).orderBy(desc(notifications.createdAt)).limit(80);
  return Response.json({ notifications: rows, unreadCount: rows.filter((item) => !item.readAt).length });
}

export async function PATCH() {
  const owner = await recipient();
  if (!owner) return Response.json({ error: "Session expirée." }, { status: 401 });
  await getDb().update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.recipientType, owner.type), eq(notifications.recipientId, owner.id), isNull(notifications.readAt)));
  return Response.json({ ok: true });
}
