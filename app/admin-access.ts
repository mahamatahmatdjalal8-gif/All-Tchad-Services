import { redirect } from "next/navigation";
import { getSiteRuntimeBindings } from "./runtime-bindings";
import { getAdminSessionEmail } from "../lib/admin-session";

export type AdminUser = {
  email: string;
  displayName: string;
  fullName: null;
};

function adminEmails() {
  const runtime =
    getSiteRuntimeBindings().ADMIN_EMAILS;

  const value =
    runtime ??
    process.env.ADMIN_EMAILS ??
    "";

  return value
    .split(",")
    .map((email) =>
      email.trim().toLowerCase(),
    )
    .filter(Boolean);
}

export function isAdminEmail(email: string) {
  return adminEmails().includes(
    email.trim().toLowerCase(),
  );
}

function sessionUser(
  email: string,
): AdminUser {
  const normalized =
    email.trim().toLowerCase();

  return {
    email: normalized,
    displayName:
      normalized.split("@")[0] ||
      "Administrateur",
    fullName: null,
  };
}

export async function requireAdminPage():
  Promise<AdminUser> {

  const sessionEmail =
    await getAdminSessionEmail();

  if (
    sessionEmail &&
    isAdminEmail(sessionEmail)
  ) {
    return sessionUser(sessionEmail);
  }

  redirect(
    "/admin-login?return_to=/admin",
  );
}

export async function getAdminApiUser():
  Promise<AdminUser | null> {

  const sessionEmail =
    await getAdminSessionEmail();

  return (
    sessionEmail &&
    isAdminEmail(sessionEmail)
  )
    ? sessionUser(sessionEmail)
    : null;
}