import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { expertPosts, serviceRequests } from "../../../../db/schema";
import { getObjectStorage } from "../../../object-storage";
import { getExpertContext } from "../../../social-auth";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedId = Number(url.searchParams.get("id"));
  const requestedKind = url.searchParams.get("kind");
  const kind = requestedKind === "after" ? "after" : requestedKind === "problem" ? "problem" : "before";
  const expert = await getExpertContext();
  if (!expert || expert.expert.status !== "accepted") return Response.json({ error: "Accès refusé." }, { status: 403 });
  const id = requestedId;
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Photo introuvable." }, { status: 404 });
  const [mission] = await getDb().select().from(serviceRequests).where(eq(serviceRequests.id, id)).limit(1);
  if (!mission || mission.assignedArtisan !== expert.expert.name) return Response.json({ error: "Photo introuvable." }, { status: 404 });
  const key = kind === "after" ? mission.afterImageKey : kind === "problem" ? mission.problemImageKey : mission.beforeImageKey;
  if (!key) return Response.json({ error: "Photo introuvable." }, { status: 404 });
  const object = await getObjectStorage()?.get(key);
  if (!object) return Response.json({ error: "Photo introuvable." }, { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "private, max-age=60");
  return new Response(object.body, { headers });
}

export async function POST(request: Request) {
  const context = await getExpertContext();
  if (!context) return Response.json({ error: "Accès expert refusé." }, { status: 403 });
  if (context.expert.status !== "accepted") return Response.json({ error: "La publication des preuves est activée après validation de la candidature." }, { status: 403 });
  const form = await request.formData();
  const id = Number(form.get("requestId"));
  const kind = form.get("kind") === "after" ? "after" : "before";
  const publicConsent = form.get("publicConsent") === "yes";
  const value = form.get("image");
  const image = value instanceof File && value.size > 0 ? value : null;
  if (!Number.isInteger(id) || id < 1 || !image || !imageTypes.has(image.type) || image.size > 8 * 1024 * 1024) return Response.json({ error: "Photo invalide ou supérieure à 8 Mo." }, { status: 400 });
  const db = getDb();
  const [mission] = await db.select().from(serviceRequests).where(and(eq(serviceRequests.id, id), eq(serviceRequests.assignedArtisan, context.expert.name))).limit(1);
  if (!mission) return Response.json({ error: "Cette demande ne vous est pas attribuée." }, { status: 404 });
  const bucket = getObjectStorage();
  if (!bucket) return Response.json({ error: "Stockage indisponible." }, { status: 503 });
  const extension = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
  const key = `request-evidence/${context.expert.id}/${id}/${kind}-${crypto.randomUUID()}.${extension}`;
  const oldKey = kind === "after" ? mission.afterImageKey : mission.beforeImageKey;
  try {
    await bucket.put(key, image.stream(), { httpMetadata: { contentType: image.type } });
    await db.update(serviceRequests).set(kind === "after" ? { afterImageKey: key, afterImageContentType: image.type, afterImageSize: image.size, updatedAt: new Date() } : { beforeImageKey: key, beforeImageContentType: image.type, beforeImageSize: image.size, updatedAt: new Date() }).where(eq(serviceRequests.id, id));
  } catch {
    await bucket.delete(key);
    return Response.json({ error: "Impossible d’enregistrer la photo." }, { status: 500 });
  }
  if (oldKey) await bucket.delete(oldKey).catch(() => undefined);

  const beforeImageKey = kind === "before" ? key : mission.beforeImageKey;
  const afterImageKey = kind === "after" ? key : mission.afterImageKey;
  let publicPost = null;
  let publicationWarning = false;
  if (beforeImageKey && afterImageKey && publicConsent) {
    try {
      const body = `Avant / après d’une intervention de ${mission.service}. Découvrez le résultat du travail réalisé.`;
      const [existing] = await db.select().from(expertPosts).where(eq(expertPosts.requestId, id)).limit(1);
      if (existing) {
        [publicPost] = await db.update(expertPosts).set({ postType: "before-after", body, updatedAt: new Date() }).where(eq(expertPosts.id, existing.id)).returning();
      } else {
        [publicPost] = await db.insert(expertPosts).values({ expertId: context.expert.id, requestId: id, postType: "before-after", body }).returning();
      }
    } catch {
      publicationWarning = true;
    }
  }
  return Response.json({ ok: true, kind, url: `/api/expert/request-photos?id=${id}&kind=${kind}`, published: Boolean(publicPost), publicationWarning, post: publicPost });
}
