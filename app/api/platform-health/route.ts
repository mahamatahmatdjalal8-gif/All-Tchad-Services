import { sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { getObjectStorage } from "../../object-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({
      ok: true,
      database: "connected",
      storage: getObjectStorage() ? "configured" : "missing_configuration",
    });
  } catch {
    return Response.json(
      { ok: false, database: "unavailable", storage: getObjectStorage() ? "configured" : "missing_configuration" },
      { status: 503 },
    );
  }
}
