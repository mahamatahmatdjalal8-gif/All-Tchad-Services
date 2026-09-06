import postgres from "postgres";

export type AppSettings = {
  homeEyebrow: string;
  homeTitle: string;
  homeDescription: string;
  announcement: string;
  whatsapp: string;
  phone: string;
  requestsEnabled: boolean;
  postsEnabled: boolean;
  maintenanceMode: boolean;
};

export const defaultAppSettings: AppSettings = {
  homeEyebrow: "Le bon expert, au bon moment",
  homeTitle: "Que recherchez-vous aujourd’hui ?",
  homeDescription:
    "Découvrez les experts, leurs réalisations et leur disponibilité. Demandez un prix avant le travail.",
  announcement: "",
  whatsapp: "23563304046",
  phone: "",
  requestsEnabled: true,
  postsEnabled: true,
  maintenanceMode: false,
};

type SqlClient = ReturnType<typeof postgres>;

type SettingsGlobal = typeof globalThis & {
  __ATS_SETTINGS_SQL__?: SqlClient;
};

function databaseUrl() {
  const value =
    process.env.POSTGRES_URL?.trim() ||
    process.env.DATABASE_URL?.trim();

  if (!value) {
    throw new Error(
      "POSTGRES_URL ou DATABASE_URL est absent."
    );
  }

  return value;
}

function getSql() {
  const runtime = globalThis as SettingsGlobal;

  if (runtime.__ATS_SETTINGS_SQL__) {
    return runtime.__ATS_SETTINGS_SQL__;
  }

  const sql = postgres(databaseUrl(), {
    max: 2,
    prepare: false,
    idle_timeout: 10,
    connect_timeout: 10,
  });

  runtime.__ATS_SETTINGS_SQL__ = sql;

  return sql;
}

async function ensureSettingsTable() {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY,
      home_eyebrow TEXT NOT NULL,
      home_title TEXT NOT NULL,
      home_description TEXT NOT NULL,
      announcement TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      phone TEXT NOT NULL,
      requests_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      posts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    INSERT INTO app_settings (
      id,
      home_eyebrow,
      home_title,
      home_description,
      announcement,
      whatsapp,
      phone,
      requests_enabled,
      posts_enabled,
      maintenance_mode
    )
    VALUES (
      1,
      ${defaultAppSettings.homeEyebrow},
      ${defaultAppSettings.homeTitle},
      ${defaultAppSettings.homeDescription},
      ${defaultAppSettings.announcement},
      ${defaultAppSettings.whatsapp},
      ${defaultAppSettings.phone},
      ${defaultAppSettings.requestsEnabled},
      ${defaultAppSettings.postsEnabled},
      ${defaultAppSettings.maintenanceMode}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

function cleanText(value: unknown, fallback: string, max = 500) {
  if (typeof value !== "string") return fallback;

  const result = value.trim();

  return result.slice(0, max);
}

export async function readAppSettings(): Promise<AppSettings> {
  const sql = getSql();

  await ensureSettingsTable();

  const rows = await sql`
    SELECT
      home_eyebrow,
      home_title,
      home_description,
      announcement,
      whatsapp,
      phone,
      requests_enabled,
      posts_enabled,
      maintenance_mode
    FROM app_settings
    WHERE id = 1
    LIMIT 1
  `;

  const row = rows[0];

  if (!row) {
    return defaultAppSettings;
  }

  return {
    homeEyebrow: String(row.home_eyebrow),
    homeTitle: String(row.home_title),
    homeDescription: String(row.home_description),
    announcement: String(row.announcement),
    whatsapp: String(row.whatsapp),
    phone: String(row.phone),
    requestsEnabled: Boolean(row.requests_enabled),
    postsEnabled: Boolean(row.posts_enabled),
    maintenanceMode: Boolean(row.maintenance_mode),
  };
}

export async function updateAppSettings(
  input: Partial<AppSettings>,
): Promise<AppSettings> {
  const current = await readAppSettings();

  const next: AppSettings = {
    homeEyebrow: cleanText(
      input.homeEyebrow,
      current.homeEyebrow,
      100,
    ),
    homeTitle: cleanText(
      input.homeTitle,
      current.homeTitle,
      160,
    ),
    homeDescription: cleanText(
      input.homeDescription,
      current.homeDescription,
      500,
    ),
    announcement: cleanText(
      input.announcement,
      current.announcement,
      500,
    ),
    whatsapp: cleanText(
      input.whatsapp,
      current.whatsapp,
      30,
    ).replace(/[^\d+]/g, ""),
    phone: cleanText(
      input.phone,
      current.phone,
      30,
    ).replace(/[^\d+]/g, ""),
    requestsEnabled:
      typeof input.requestsEnabled === "boolean"
        ? input.requestsEnabled
        : current.requestsEnabled,
    postsEnabled:
      typeof input.postsEnabled === "boolean"
        ? input.postsEnabled
        : current.postsEnabled,
    maintenanceMode:
      typeof input.maintenanceMode === "boolean"
        ? input.maintenanceMode
        : current.maintenanceMode,
  };

  const sql = getSql();

  await ensureSettingsTable();

  await sql`
    UPDATE app_settings
    SET
      home_eyebrow = ${next.homeEyebrow},
      home_title = ${next.homeTitle},
      home_description = ${next.homeDescription},
      announcement = ${next.announcement},
      whatsapp = ${next.whatsapp},
      phone = ${next.phone},
      requests_enabled = ${next.requestsEnabled},
      posts_enabled = ${next.postsEnabled},
      maintenance_mode = ${next.maintenanceMode},
      updated_at = NOW()
    WHERE id = 1
  `;

  return next;
}