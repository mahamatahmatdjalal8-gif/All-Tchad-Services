import { count, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { expertPosts, postShares, postViews } from "../../../../db/schema";

const clean = (value: unknown, max = 90) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = clean(body.action, 20);
  const visitorKey = clean(body.visitorKey);
  const postId = Number(body.postId);

  if ((action !== "view" && action !== "share") || !Number.isInteger(postId) || postId < 1 || !/^[A-Za-z0-9_-]{8,90}$/.test(visitorKey)) {
    return Response.json({ error: "Donnée de trafic invalide." }, { status: 400 });
  }

  const db = getDb();
  const [post] = await db.select({ id: expertPosts.id }).from(expertPosts).where(eq(expertPosts.id, postId)).limit(1);
  if (!post) return Response.json({ error: "Publication introuvable." }, { status: 404 });

  if (action === "view") {
    await db.insert(postViews).values({ postId, visitorKey }).onConflictDoNothing();
    const [metric] = await db.select({ value: count() }).from(postViews).where(eq(postViews.postId, postId));
    return Response.json({ ok: true, count: metric.value });
  }

  await db.insert(postShares).values({ postId, visitorKey }).onConflictDoNothing();
  const [metric] = await db.select({ value: count() }).from(postShares).where(eq(postShares.postId, postId));
  return Response.json({ ok: true, count: metric.value });
}
