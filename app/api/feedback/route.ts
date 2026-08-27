import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { feedbackEntries, serviceRequests } from "../../../db/schema";
import { getAdminApiUser } from "../../admin-access";
import { notifyExpertForRequest } from "../../notification-service";

const clean = (value: unknown, max = 500) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

function reference() {
  return `FB-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
}

export async function GET() {
  if (!(await getAdminApiUser())) return Response.json({ error: "Accès refusé" }, { status: 403 });
  const rows = await getDb().select().from(feedbackEntries).orderBy(desc(feedbackEntries.createdAt)).limit(250);
  return Response.json({ feedback: rows });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (clean(body.website)) return new Response(null, { status: 204 });
    const kind = clean(body.kind, 20);
    const ratingValue = Number(body.rating);
    const values = {
      reference: reference(),
      requestReference: null as string | null,
      kind,
      customerName: clean(body.customerName, 100),
      customerPhone: clean(body.customerPhone, 30),
      rating: kind === "review" && ratingValue >= 1 && ratingValue <= 5 ? ratingValue : null,
      details: clean(body.details, 1000),
    };
    if (!values.customerName || !values.customerPhone || !values.details || !["review", "complaint"].includes(kind) || (kind === "review" && !values.rating)) {
      return Response.json({ error: "Le formulaire est incomplet." }, { status: 400 });
    }
    if (kind === "review") {
      const db = getDb();
      const [intervention] = await db.select({ reference: serviceRequests.reference }).from(serviceRequests).where(and(eq(serviceRequests.customerPhone, values.customerPhone), eq(serviceRequests.status, "completed"))).orderBy(desc(serviceRequests.completedAt)).limit(1);
      if (!intervention) {
        return Response.json({ error: "Aucune intervention terminée ne correspond à ce numéro de téléphone." }, { status: 400 });
      }
      values.requestReference = intervention.reference;
      const [existing] = await db.select({ id: feedbackEntries.id }).from(feedbackEntries).where(and(eq(feedbackEntries.kind, "review"), eq(feedbackEntries.requestReference, intervention.reference))).limit(1);
      if (existing) return Response.json({ error: "Cette intervention a déjà reçu une note." }, { status: 409 });
    }
    const [row] = await getDb().insert(feedbackEntries).values(values).returning({ reference: feedbackEntries.reference });
    if (kind === "review" && values.requestReference) {
      const [intervention] = await getDb().select({ id: serviceRequests.id }).from(serviceRequests).where(eq(serviceRequests.reference, values.requestReference)).limit(1);
      if (intervention) await notifyExpertForRequest(intervention.id, "new_review", "Nouvel avis client", `${values.rating}/5 · ${values.details.slice(0, 120)}`);
    }
    return Response.json({ reference: row.reference }, { status: 201 });
  } catch {
    return Response.json({ error: "Impossible d’enregistrer votre message." }, { status: 500 });
  }
}
