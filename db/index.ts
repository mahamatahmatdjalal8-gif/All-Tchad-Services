import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { rootCertificates } from "node:tls";
import { SUPABASE_CA } from "./supabase-ca";
import * as schema from "./schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;

type DatabaseGlobal = typeof globalThis & {
  __ALLO_TCHAD_PG_DATABASE__?: Database;
};

function databaseUrl() {
  const value =
    process.env.POSTGRES_URL?.trim() ||
    process.env.DATABASE_URL?.trim();

  if (!value) {
    throw new Error(
      "La connexion PostgreSQL est absente. Ajoutez POSTGRES_URL ou DATABASE_URL dans Vercel.",
    );
  }

  return value;
}

export function getDb(): Database {
  const runtime = globalThis as DatabaseGlobal;
  if (runtime.__ALLO_TCHAD_PG_DATABASE__) return runtime.__ALLO_TCHAD_PG_DATABASE__;
  const connectionUrl = new URL(databaseUrl());
  const supabaseHost = connectionUrl.hostname.endsWith(".supabase.co") ||
    connectionUrl.hostname.endsWith(".pooler.supabase.com");
  if (supabaseHost) {
    // pg parses these URL options after Pool options and would replace our CA.
    for (const key of ["sslmode", "sslrootcert", "sslcert", "sslkey", "ssl", "uselibpqcompat"]) {
      connectionUrl.searchParams.delete(key);
    }
  }
  const client = new Pool({
    connectionString: connectionUrl.toString(),
    ...(supabaseHost ? {
      ssl: { ca: [...rootCertificates, SUPABASE_CA], rejectUnauthorized: true },
    } : {}),
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 5000,
    query_timeout: 15000,
    maxLifetimeSeconds: 300,
    keepAlive: true,
  });
  client.on("error", () => {
    // Do not log connection strings or query parameters.
    console.error("Database idle connection failed; the pool will replace it.");
  });
  attachDatabasePool(client);
  const database = drizzle(client, { schema });

  runtime.__ALLO_TCHAD_PG_DATABASE__ = database;
  return database;
}
