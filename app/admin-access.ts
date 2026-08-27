import { getChatGPTUser, requireChatGPTUser, type ChatGPTUser } from "./chatgpt-auth";
import { getSiteRuntimeBindings } from "./runtime-bindings";

function adminEmails() {
  const value = getSiteRuntimeBindings().ADMIN_EMAILS ?? process.env.ADMIN_EMAILS ?? "";
  return value
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string) {
  return adminEmails().includes(email.trim().toLowerCase());
}

export async function requireAdminPage(): Promise<ChatGPTUser | null> {
  const user = await requireChatGPTUser("/admin");
  return isAdminEmail(user.email) ? user : null;
}

export async function getAdminApiUser(): Promise<ChatGPTUser | null> {
  const user = await getChatGPTUser();
  return user && isAdminEmail(user.email) ? user : null;
}
