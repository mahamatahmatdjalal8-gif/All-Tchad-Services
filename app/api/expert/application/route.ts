import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "../../../../db";
import { artisanApplications } from "../../../../db/schema";
import { getChatGPTUser } from "../../../chatgpt-auth";

const clean = (value: unknown, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Connexion requise." }, { status: 401 });
  const db = getDb();
  const [application] = await db.select().from(artisanApplications).where(and(eq(artisanApplications.loginEmail, user.email.trim().toLowerCase()), ne(artisanApplications.status, "accepted"))).orderBy(desc(artisanApplications.createdAt)).limit(1);
  if (!application) return Response.json({ error: "Aucun dossier modifiable." }, { status: 404 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const phone = clean(body.phone, 30), area = clean(body.area, 120), coverage = clean(body.coverage), availability = clean(body.availability, 120), workExamples = clean(body.workExamples, 1200), proof = clean(body.proof, 800);
  if (!phone || !area || !coverage || !availability || !workExamples || !proof) return Response.json({ error: "Complétez tous les champs obligatoires." }, { status: 400 });
  await db.update(artisanApplications).set({ phone, area, coverage, availability, workExamples, proof, workshopAddress: clean(body.workshopAddress, 180) || null, status: "pending", reviewNote: null, updatedAt: new Date() }).where(eq(artisanApplications.id, application.id));
  return Response.json({ ok: true });
}
