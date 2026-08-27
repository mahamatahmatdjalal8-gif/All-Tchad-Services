import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { artisanApplications } from "../../../../db/schema";
import { getExpertContext } from "../../../social-auth";

const clean = (value: unknown, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function PUT(request: Request) {
  const context = await getExpertContext();
  if (!context) return Response.json({ error: "Accès expert refusé." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const availability = clean(body.availability, 120), coverage = clean(body.coverage), workingHours = clean(body.workingHours, 180), workshopAddress = clean(body.workshopAddress, 180), profileBio = clean(body.profileBio, 220);
  if (!availability || !coverage) return Response.json({ error: "Disponibilité et zone d’intervention requises." }, { status: 400 });
  await getDb().update(artisanApplications).set({ availability, coverage, workingHours: workingHours || null, workshopAddress: workshopAddress || null, profileBio: profileBio || null, updatedAt: new Date() }).where(eq(artisanApplications.id, context.expert.id));
  return Response.json({ ok: true });
}
