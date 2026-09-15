import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { feedbackEntries, serviceRequests } from "../../../db/schema";
import { getAdminApiUser } from "../../admin-access";
import { createNotification } from "../../notification-service";
import { getExpertContext } from "../../social-auth";

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
    if (kind === "review") {
      const context = await getExpertContext();
      if (!context) return Response.json({ error: "Connectez-vous pour laisser votre avis." }, { status: 401 });
      const requestId = Number(body.requestId);
      const details = clean(body.details, 1000);
      if (!Number.isInteger(requestId) || requestId < 1 || !Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5 || !details) {
        return Response.json({ error: "Choisissez une note et décrivez votre expérience." }, { status: 400 });
      }
      const result = await getDb().transaction(async (tx) => {
        const [mission] = await tx.select().from(serviceRequests).where(eq(serviceRequests.id, requestId)).for("update").limit(1);
        if (!mission || mission.requestKind !== "service" || mission.requesterExpertId !== context.expert.id) {
          return { error: "Mission introuvable.", status: 404 } as const;
        }
        if (mission.status !== "completed" || mission.expertDecision !== "accepted") {
          return { error: "Vous pourrez donner votre avis une fois la mission terminée.", status: 409 } as const;
        }
        const [existing] = await tx.select({ id: feedbackEntries.id }).from(feedbackEntries).where(and(eq(feedbackEntries.kind, "review"), eq(feedbackEntries.requestReference, mission.reference))).limit(1);
        if (existing) return { error: "Cette mission a déjà reçu votre avis.", status: 409 } as const;
        const [row] = await tx.insert(feedbackEntries).values({ reference: reference(), requestReference: mission.reference, kind: "review", customerName: mission.customerName, customerPhone: mission.customerPhone, rating: ratingValue, details }).returning({ reference: feedbackEntries.reference });
        return { reference: row.reference, targetExpertId: mission.targetExpertId } as const;
      });
      if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
      if (result.targetExpertId) await createNotification({ recipientType: "expert", recipientId: result.targetExpertId, requestId, kind: "new_review", title: "Nouvel avis client", body: `${ratingValue}/5 · ${details.slice(0, 120)}` }).catch(() => console.error("Review notification unavailable."));
      return Response.json({ reference: result.reference }, { status: 201 });
    }
    const values = {
      reference: reference(),
      requestReference: null as string | null,
      kind,
      customerName: clean(body.customerName, 100),
      customerPhone: clean(body.customerPhone, 30),
      rating: null,
      details: clean(body.details, 1000),
    };
    if (!values.customerName || !values.customerPhone || !values.details || kind !== "complaint") {
      return Response.json({ error: "Le formulaire est incomplet." }, { status: 400 });
    }
    const [row] = await getDb().insert(feedbackEntries).values(values).returning({ reference: feedbackEntries.reference });
    return Response.json({ reference: row.reference }, { status: 201 });
  } catch {
    return Response.json({ error: "Impossible d’enregistrer votre message." }, { status: 500 });
  }
}
