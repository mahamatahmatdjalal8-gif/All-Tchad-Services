import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { artisanDocuments } from "../../../../../db/schema";
import { getAdminApiUser } from "../../../../admin-access";
import { getObjectStorage } from "../../../../object-storage";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await getAdminApiUser())) return Response.json({ error: "Accès refusé" }, { status: 403 });
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Document invalide" }, { status: 400 });

  const [document] = await getDb().select({
    storageKey: artisanDocuments.storageKey,
    contentType: artisanDocuments.contentType,
  }).from(artisanDocuments).where(eq(artisanDocuments.id, id)).limit(1);
  if (!document) return Response.json({ error: "Document introuvable" }, { status: 404 });

  const bucket = getObjectStorage();
  if (!bucket) return Response.json({ error: "Stockage indisponible" }, { status: 503 });
  const object = await bucket.get(document.storageKey);
  if (!object) return Response.json({ error: "Fichier introuvable" }, { status: 404 });

  return new Response(object.body, {
    headers: {
      "Content-Type": document.contentType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
