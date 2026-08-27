import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { expertPosts, serviceRequests } from "../../../../../db/schema";
import { getObjectStorage } from "../../../../object-storage";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id < 1) return new Response("Image invalide", { status: 400 });
  const [post] = await getDb().select({ imageKey: expertPosts.imageKey, imageContentType: expertPosts.imageContentType, requestId: expertPosts.requestId }).from(expertPosts).where(eq(expertPosts.id, id)).limit(1);
  if (!post) return new Response("Image introuvable", { status: 404 });
  let imageKey = post.imageKey;
  let contentType = post.imageContentType;
  const kind = new URL(request.url).searchParams.get("kind");
  if (post.requestId && (kind === "before" || kind === "after")) {
    const [mission] = await getDb().select({ beforeImageKey: serviceRequests.beforeImageKey, beforeImageContentType: serviceRequests.beforeImageContentType, afterImageKey: serviceRequests.afterImageKey, afterImageContentType: serviceRequests.afterImageContentType }).from(serviceRequests).where(eq(serviceRequests.id, post.requestId)).limit(1);
    imageKey = kind === "before" ? mission?.beforeImageKey ?? null : mission?.afterImageKey ?? null;
    contentType = kind === "before" ? mission?.beforeImageContentType ?? null : mission?.afterImageContentType ?? null;
  }
  if (!imageKey) return new Response("Image introuvable", { status: 404 });
  const object = await getObjectStorage()?.get(imageKey);
  if (!object) return new Response("Image introuvable", { status: 404 });
  return new Response(object.body, { headers: { "Content-Type": contentType || "image/jpeg", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" } });
}
