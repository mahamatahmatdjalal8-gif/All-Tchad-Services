import {
  createHmac,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

import { cookies } from "next/headers";

export const ADMIN_SESSION_COOKIE =
  "ats_admin_session";

const SESSION_DURATION_SECONDS =
  60 * 60 * 8;

type SessionPayload = {
  email: string;
  exp: number;
};

function sessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET?.trim() ??
    ""
  );
}

function sign(value: string) {
  const secret = sessionSecret();

  if (!secret) {
    throw new Error(
      "ADMIN_SESSION_SECRET absent.",
    );
  }

  return createHmac(
    "sha256",
    secret,
  )
    .update(value)
    .digest("base64url");
}

export function createAdminSessionToken(
  email: string,
) {
  const payload: SessionPayload = {
    email: email.trim().toLowerCase(),
    exp:
      Math.floor(Date.now() / 1000) +
      SESSION_DURATION_SECONDS,
  };

  const encoded = Buffer.from(
    JSON.stringify(payload),
    "utf8",
  ).toString("base64url");

  return `${encoded}.${sign(encoded)}`;
}

function verifyToken(
  token: string,
): SessionPayload | null {
  try {
    const parts = token.split(".");

    if (parts.length !== 2) {
      return null;
    }

    const [payload, signature] = parts;

    const expected = sign(payload);

    const actualBuffer = Buffer.from(
      signature,
      "utf8",
    );

    const expectedBuffer = Buffer.from(
      expected,
      "utf8",
    );

    if (
      actualBuffer.length !==
      expectedBuffer.length
    ) {
      return null;
    }

    if (
      !timingSafeEqual(
        actualBuffer,
        expectedBuffer,
      )
    ) {
      return null;
    }

    const parsed = JSON.parse(
      Buffer.from(
        payload,
        "base64url",
      ).toString("utf8"),
    ) as SessionPayload;

    if (
      !parsed.email ||
      !parsed.exp ||
      parsed.exp <=
        Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function getAdminSessionEmail() {
  const store = await cookies();

  const token =
    store.get(
      ADMIN_SESSION_COOKIE,
    )?.value;

  if (!token) {
    return null;
  }

  return verifyToken(token)?.email ?? null;
}

function perEmailHashes() {
  const raw =
    process.env.ADMIN_PASSWORD_HASHES?.trim();

  if (!raw) {
    return {} as Record<string, string>;
  }

  try {
    const parsed = JSON.parse(raw) as Record<
      string,
      unknown
    >;

    const normalized: Record<
      string,
      string
    > = {};

    for (
      const [email, value]
      of Object.entries(parsed)
    ) {
      if (typeof value !== "string") {
        continue;
      }

      normalized[
        email.trim().toLowerCase()
      ] = value.trim();
    }

    return normalized;
  } catch {
    return {};
  }
}

function verifyStoredHash(
  stored: string,
  password: string,
) {
  try {
    const [
      saltHex,
      expectedHex,
    ] = stored.split(":");

    if (
      !saltHex ||
      !expectedHex
    ) {
      return false;
    }

    const salt =
      Buffer.from(
        saltHex,
        "hex",
      );

    const expected =
      Buffer.from(
        expectedHex,
        "hex",
      );

    const actual =
      scryptSync(
        password,
        salt,
        64,
      );

    if (
      actual.length !==
      expected.length
    ) {
      return false;
    }

    return timingSafeEqual(
      actual,
      expected,
    );
  } catch {
    return false;
  }
}

export function verifyAdminPassword(
  email: string,
  password: string,
) {
  if (!email || !password) {
    return false;
  }

  const normalized =
    email.trim().toLowerCase();

  const hashes =
    perEmailHashes();

  const specificHash =
    hashes[normalized];

  if (specificHash) {
    return verifyStoredHash(
      specificHash,
      password,
    );
  }

  const legacyHash =
    process.env.ADMIN_PASSWORD_HASH?.trim();

  if (!legacyHash) {
    return false;
  }

  return verifyStoredHash(
    legacyHash,
    password,
  );
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    secure:
      process.env.NODE_ENV ===
      "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge:
      SESSION_DURATION_SECONDS,
  };
}