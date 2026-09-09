import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { artisanApplications } from "../../../../db/schema";
import { getObjectStorage } from "../../../object-storage";
import { getExpertContext } from "../../../social-auth";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function GET(request: Request) {
  const requestedId = Number(new URL(request.url).searchParams.get("id"));
  let imageKey: string | null = null;
  let isPublic = false;
  if (Number.isInteger(requestedId) && requestedId > 0) {
    const [expert] = await getDb().select({ coverImageKey: artisanApplications.coverImageKey }).from(artisanApplications).where(and(eq(artisanApplications.id, requestedId), eq(artisanApplications.status, "accepted"))).limit(1);
    imageKey = expert?.coverImageKey ?? null;
    isPublic = true;
  } else {
    const context = await getExpertContext();
    imageKey = context?.expert.coverImageKey ?? null;
  }
  if (!imageKey) return Response.json({ error: "Couverture introuvable." }, { status: 404 });
  const object = await getObjectStorage()?.get(imageKey);
  if (!object) return Response.json({ error: "Couverture introuvable." }, { status: 404 });
  const headers = new Headers(); object.writeHttpMetadata(headers); headers.set("Cache-Control", isPublic ? "public, max-age=300" : "private, max-age=60");
  return new Response(object.body, { headers });
}

export async function POST(request: Request) {
  const context = await getExpertContext();
  if (!context) return Response.json({ error: "Accès expert refusé." }, { status: 403 });
  const form = await request.formData();
  const value = form.get("image");
  const image = value instanceof File && value.size > 0 ? value : null;
  if (!image || !imageTypes.has(image.type) || image.size > 8 * 1024 * 1024) return Response.json({ error: "Image invalide ou supérieure à 8 Mo." }, { status: 400 });
  const bucket = getObjectStorage();
  if (!bucket) return Response.json({ error: "Stockage indisponible." }, { status: 503 });
  const extension = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
  const key = `expert-covers/${context.expert.id}/${crypto.randomUUID()}.${extension}`;
  try {
    await bucket.put(key, image.stream(), { httpMetadata: { contentType: image.type } });
    await getDb().update(artisanApplications).set({ coverImageKey: key, coverImageContentType: image.type, coverImageSize: image.size, updatedAt: new Date() }).where(eq(artisanApplications.id, context.expert.id));
  } catch {
    await bucket.delete(key).catch(() => undefined);
    return Response.json({ error: "Impossible d’enregistrer la couverture." }, { status: 500 });
  }
  if (context.expert.coverImageKey) await bucket.delete(context.expert.coverImageKey).catch(() => undefined);
  return Response.json({ ok: true });
}

export async function DELETE() {
  const context = await getExpertContext();

  if (!context) {
    return Response.json(
      { error: "Accès expert refusé." },
      { status: 403 },
    );
  }

  const imageKey = context.expert.coverImageKey;

  if (!imageKey) {
    return Response.json({ ok: true });
  }

  const bucket = getObjectStorage();

  if (!bucket) {
    return Response.json(
      { error: "Stockage indisponible." },
      { status: 503 },
    );
  }

  try {
    await getDb()
      .update(artisanApplications)
      .set({
        coverImageKey: null,
        coverImageContentType: null,
        coverImageSize: null,
        updatedAt: new Date(),
      })
      .where(
        eq(
          artisanApplications.id,
          context.expert.id,
        ),
      );

    await bucket
      .delete(imageKey)
      .catch(() => undefined);

    return Response.json({ ok: true });
  } catch {
    return Response.json(
      {
        error:
          "Impossible de supprimer la couverture.",
      },
      { status: 500 },
    );
  }
}