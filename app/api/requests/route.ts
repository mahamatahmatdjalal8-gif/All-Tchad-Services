import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { serviceRequests } from "../../../db/schema";
import { getAdminApiUser } from "../../admin-access";
import { createTrackingReference } from "../../tracking-reference";
import { readAppSettings } from "../../../lib/app-settings";

const clean = (value: unknown, max = 500) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export async function GET() {
  if (!(await getAdminApiUser())) return Response.json({ error: "Accès refusé" }, { status: 403 });
  const rows = await getDb().select().from(serviceRequests).orderBy(desc(serviceRequests.createdAt)).limit(250);
  return Response.json({ requests: rows });
}

export async function POST(request: Request) {
  try {
    const settings = await readAppSettings();

    if (
      !settings.requestsEnabled ||
      settings.maintenanceMode
    ) {
      return Response.json(
        {
          error:
            "Les nouvelles demandes sont temporairement indisponibles.",
        },
        { status: 503 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    if (clean(body.website)) return new Response(null, { status: 204 });

    const preferredExpert = clean(body.preferredExpert, 100);
    const requestDetails = clean(body.details, 800);
    const values = {
      reference: createTrackingReference("REQ"),
      customerName: clean(body.customerName, 100),
      customerPhone: clean(body.customerPhone, 30),
      service: clean(body.service, 80),
      city: clean(body.city, 80),
      district: clean(body.district, 120),
      urgency: clean(body.urgency, 30),
      details: preferredExpert ? `Expert souhaité : ${preferredExpert}\n${requestDetails}`.slice(0, 800) : requestDetails,
    };
    if (Object.values(values).some((value) => !value)) {
      return Response.json({ error: "Tous les champs sont obligatoires." }, { status: 400 });
    }

    await getDb().insert(serviceRequests).values(values);
    return Response.json({ success: true }, { status: 201 });
  } catch {
    return Response.json({ error: "Impossible d’enregistrer la demande." }, { status: 500 });
  }
}
