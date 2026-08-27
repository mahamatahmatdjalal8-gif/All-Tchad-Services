import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { expertPosts, postComments, postReplies } from "../../../../db/schema";
import { getExpertContext } from "../../../social-auth";
import { getObjectStorage } from "../../../object-storage";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const postTypes = new Set(["work", "before-after", "available", "tip", "offer"]);
const clean = (value: unknown, max = 1200) => typeof value === "string" ? value.trim().slice(0, max) : "";
const exposesPrivateData = (value: string) => /\b\d{8,}\b/.test(value) || /\b(?:nni|carte d.identit[eé]|adresse priv[eé]e)\b/i.test(value);

export async function GET() {
  const context = await getExpertContext();
  if (!context) return Response.json({ error: "Accès expert refusé." }, { status: 403 });
  const posts = await getDb().select().from(expertPosts).where(eq(expertPosts.expertId, context.expert.id)).orderBy(desc(expertPosts.createdAt)).limit(100);
  return Response.json({ posts });
}

export async function POST(request: Request) {
  const context = await getExpertContext();
  if (!context) return Response.json({ error: "Accès expert refusé." }, { status: 403 });
  if (context.expert.status !== "accepted") return Response.json({ error: "Votre candidature doit être acceptée avant de publier." }, { status: 403 });
  if (!context.expert.profileImageKey) return Response.json({ error: "Ajoutez d’abord votre photo de profil pour publier." }, { status: 400 });
  const form = await request.formData();
  const body = clean(form.get("body"));
  const requestedPostType = clean(form.get("postType"), 30);
  const postType = postTypes.has(requestedPostType) ? requestedPostType : "work";
  const fileValue = form.get("image");
  const image = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
  if (body.length < 10) return Response.json({ error: "Décrivez le travail réalisé en au moins 10 caractères." }, { status: 400 });
  if (exposesPrivateData(body)) return Response.json({ error: "Retirez les numéros, NNI ou adresses privées avant de publier." }, { status: 400 });
  if (image && (!imageTypes.has(image.type) || image.size > 8 * 1024 * 1024)) return Response.json({ error: "Photo invalide ou supérieure à 8 Mo." }, { status: 400 });
  const bucket = getObjectStorage();
  if (image && !bucket) return Response.json({ error: "Stockage indisponible." }, { status: 503 });
  let imageKey: string | null = null;
  try {
    if (image && bucket) {
      const extension = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
      imageKey = `expert-posts/${context.expert.id}/${crypto.randomUUID()}.${extension}`;
      await bucket.put(imageKey, image.stream(), { httpMetadata: { contentType: image.type } });
    }
    const [post] = await getDb().insert(expertPosts).values({ expertId: context.expert.id, postType, body, imageKey, imageContentType: image?.type ?? null, imageSize: image?.size ?? null }).returning();
    return Response.json({ post }, { status: 201 });
  } catch {
    if (imageKey && bucket) await bucket.delete(imageKey);
    return Response.json({ error: "Impossible de publier pour le moment." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const context = await getExpertContext();
  if (!context) return Response.json({ error: "Accès expert refusé." }, { status: 403 });
  if (context.expert.status !== "accepted") return Response.json({ error: "Votre candidature doit être acceptée avant de gérer des publications." }, { status: 403 });
  const payload = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = clean(payload.action, 20);
  const db = getDb();
  if (action === "reply") {
    const commentId = Number(payload.commentId), body = clean(payload.body, 500);
    if (!Number.isInteger(commentId) || commentId < 1 || body.length < 2) return Response.json({ error: "Réponse invalide." }, { status: 400 });
    const [owned] = await db.select({ id: postComments.id }).from(postComments).innerJoin(expertPosts, eq(postComments.postId, expertPosts.id)).where(and(eq(postComments.id, commentId), eq(expertPosts.expertId, context.expert.id))).limit(1);
    if (!owned) return Response.json({ error: "Commentaire introuvable." }, { status: 404 });
    const [reply] = await db.insert(postReplies).values({ commentId, expertId: context.expert.id, body }).returning();
    return Response.json({ reply });
  }
  const id = Number(payload.id), body = clean(payload.body), requestedPostType = clean(payload.postType, 30);
  if (!Number.isInteger(id) || id < 1 || body.length < 10 || !postTypes.has(requestedPostType)) return Response.json({ error: "Publication invalide." }, { status: 400 });
  if (exposesPrivateData(body)) return Response.json({ error: "Retirez les numéros, NNI ou adresses privées avant de publier." }, { status: 400 });
  const [post] = await db.update(expertPosts).set({ body, postType: requestedPostType, moderationStatus: "published", updatedAt: new Date() }).where(and(eq(expertPosts.id, id), eq(expertPosts.expertId, context.expert.id))).returning();
  if (!post) return Response.json({ error: "Publication introuvable." }, { status: 404 });
  return Response.json({ post });
}

export async function DELETE(request: Request) {
  const context = await getExpertContext();
  if (!context) return Response.json({ error: "Accès expert refusé." }, { status: 403 });
  if (context.expert.status !== "accepted") return Response.json({ error: "Votre candidature doit être acceptée avant de gérer des publications." }, { status: 403 });
  const payload = await request.json().catch(() => ({})) as Record<string, unknown>;
  const id = Number(payload.id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Publication invalide." }, { status: 400 });
  const db = getDb();
  const [post] = await db.select().from(expertPosts).where(and(eq(expertPosts.id, id), eq(expertPosts.expertId, context.expert.id))).limit(1);
  if (!post) return Response.json({ error: "Publication introuvable." }, { status: 404 });
  await db.delete(expertPosts).where(eq(expertPosts.id, id));
  if (post.imageKey) await getObjectStorage()?.delete(post.imageKey);
  return Response.json({ ok: true, id });
}
