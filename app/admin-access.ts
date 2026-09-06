import { redirect } from "next/navigation";
import {
  getChatGPTUser,
  type ChatGPTUser,
} from "./chatgpt-auth";
import { getSiteRuntimeBindings } from "./runtime-bindings";
import { getAdminSessionEmail } from "../lib/admin-session";

function adminEmails() {
  const value =
    getSiteRuntimeBindings().ADMIN_EMAILS ??
    process.env.ADMIN_EMAILS ??
    "";

  return value
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string) {
  return adminEmails().includes(
    email.trim().toLowerCase(),
  );
}

function sessionUser(email: string): ChatGPTUser {
  const normalized = email.trim().toLowerCase();

  return {
    email: normalized,
    displayName: normalized.split("@")[0] || "Administrateur",
    fullName: null,
  };
}

export async function requireAdminPage(): Promise<ChatGPTUser | null> {
  const sessionEmail = await getAdminSessionEmail();

  if (sessionEmail && isAdminEmail(sessionEmail)) {
    return sessionUser(sessionEmail);
  }

  // Compatibilité avec l'ancien environnement ChatGPT Sites
  const chatGPTUser = await getChatGPTUser();

  if (chatGPTUser && isAdminEmail(chatGPTUser.email)) {
    return chatGPTUser;
  }

  redirect("/admin-login?return_to=/admin");
}

export async function getAdminApiUser(): Promise<ChatGPTUser | null> {
  const sessionEmail = await getAdminSessionEmail();

  if (sessionEmail && isAdminEmail(sessionEmail)) {
    return sessionUser(sessionEmail);
  }

  const chatGPTUser = await getChatGPTUser();

  return chatGPTUser && isAdminEmail(chatGPTUser.email)
    ? chatGPTUser
    : null;
}