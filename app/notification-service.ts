import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { artisanApplications, notifications, serviceRequests } from "../db/schema";

type NoticeInput = {
  requestId?: number | null;
  recipientType: "client" | "expert";
  recipientId: number;
  kind: string;
  title: string;
  body: string;
};

export async function createNotification(input: NoticeInput) {
  await getDb().insert(notifications).values({
    requestId: input.requestId ?? null,
    recipientType: input.recipientType,
    recipientId: input.recipientId,
    kind: input.kind.slice(0, 40),
    title: input.title.slice(0, 120),
    body: input.body.slice(0, 400),
  });
}

export async function notifyClient(requestId: number, kind: string, title: string, body: string) {
  return createNotification({ requestId, recipientType: "client", recipientId: requestId, kind, title, body });
}

export async function expertIdForRequest(requestId: number) {
  const db = getDb();
  const [mission] = await db.select({ assignedArtisan: serviceRequests.assignedArtisan }).from(serviceRequests).where(eq(serviceRequests.id, requestId)).limit(1);
  if (!mission?.assignedArtisan) return null;
  const [expert] = await db.select({ id: artisanApplications.id }).from(artisanApplications).where(eq(artisanApplications.name, mission.assignedArtisan)).limit(1);
  return expert?.id ?? null;
}

export async function notifyExpertForRequest(requestId: number, kind: string, title: string, body: string) {
  const expertId = await expertIdForRequest(requestId);
  if (!expertId) return;
  return createNotification({ requestId, recipientType: "expert", recipientId: expertId, kind, title, body });
}
