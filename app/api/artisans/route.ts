import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { artisanApplications } from "../../../db/schema";
import { getAdminApiUser } from "../../admin-access";
import { createTrackingReference } from "../../tracking-reference";
import { getPersonalContext } from "../../account-auth";
import { eq } from "drizzle-orm";

const clean = (value: unknown, max = 500) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export async function GET() {
  if (!(await getAdminApiUser())) return Response.json({ error: "Accès refusé" }, { status: 403 });
  const rows = await getDb().select().from(artisanApplications).orderBy(desc(artisanApplications.createdAt)).limit(250);
  return Response.json({ artisans: rows });
}

export async function POST(request: Request) {
  try {
    const personal = await getPersonalContext();
    if (!personal) return Response.json({ error: "Connectez-vous à votre compte personnel avant de candidater.", requiresAccount: true }, { status: 401 });
    const [existing] = await getDb().select().from(artisanApplications).where(eq(artisanApplications.accountId, personal.account.id)).limit(1);
    if (existing && !["account_only", "rejected"].includes(existing.status)) return Response.json({ error: existing.status === "pending" ? "Votre candidature est déjà en cours de vérification." : "Votre profil professionnel est déjà activé.", reference: existing.reference, status: existing.status }, { status: 409 });
    const body = await request.formData();
    if (clean(body.get("website"))) return new Response(null, { status: 204 });
    const experience = Number(body.get("experience"));
    const values = {
      reference: createTrackingReference("ART"),
      accountId: personal.account.id,
      name: personal.account.name,
      phone: personal.account.phone,
      loginEmail: null,
      trade: clean(body.get("trade"), 100),
      area: clean(body.get("area"), 150),
      coverage: clean(body.get("coverage"), 200),
      experience,
      availability: clean(body.get("availability"), 100),
      proof: "Non demandé",
      workExamples: "Non demandé",
      identityType: clean(body.get("identityType"), 50),
      identityNumber: clean(body.get("identityNumber"), 80),
      workshopAddress: clean(body.get("workshopAddress"), 180),
      referenceOneName: null,
      referenceOnePhone: null,
      referenceTwoName: null,
      referenceTwoPhone: null,
      status: "pending",
    };
    const requiredText = [values.name, values.phone, values.trade, values.area, values.coverage, values.availability, values.identityType, values.identityNumber, values.workshopAddress];
    if (!/^\d{10}$/.test(values.identityNumber)) return Response.json({ error: "Le NNI est obligatoire et doit contenir exactement 10 chiffres." }, { status: 400 });
    if (requiredText.some((value) => !value) || !Number.isInteger(experience) || experience < 1 || experience > 50 || clean(body.get("publicListing"), 5) !== "on" || clean(body.get("identityConsent"), 5) !== "on" || clean(body.get("conductConsent"), 5) !== "on") {
      return Response.json({ error: "Le dossier est incomplet ou invalide." }, { status: 400 });
    }

    const db = getDb();
    const [row] = existing
      ? await db.update(artisanApplications).set({ ...values, reference: existing.reference, accountId: personal.account.id, reviewNote: null, updatedAt: new Date() }).where(eq(artisanApplications.id, existing.id)).returning({ reference: artisanApplications.reference })
      : await db.insert(artisanApplications).values(values).returning({ reference: artisanApplications.reference });
    return Response.json({ reference: row.reference, ready: false, status: "pending" }, { status: 201 });
  } catch {
    return Response.json({ error: "Impossible d’enregistrer la candidature." }, { status: 500 });
  }
}
