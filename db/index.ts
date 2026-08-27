import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;

type DatabaseGlobal = typeof globalThis & {
  __ALLO_TCHAD_DATABASE__?: Database;
  __ALLO_TCHAD_SQL__?: ReturnType<typeof postgres>;
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

export function getDb(): Database {  const runtime = globalThis as DatabaseGlobal;
  if (runtime.__ALLO_TCHAD_DATABASE__) return runtime.__ALLO_TCHAD_DATABASE__;

  const client = postgres(databaseUrl(), {
    max: 1,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 15,
  });
  const database = drizzle(client, { schema });

  runtime.__ALLO_TCHAD_SQL__ = client;
  runtime.__ALLO_TCHAD_DATABASE__ = database;
  return database;
}
