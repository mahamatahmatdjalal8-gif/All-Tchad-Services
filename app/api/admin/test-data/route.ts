import { count } from "drizzle-orm";
import { getDb } from "../../../../db";
import { artisanApplications, artisanDocuments, expertPosts, feedbackEntries, notifications, personalAccounts, serviceRequests } from "../../../../db/schema";
import { getAdminApiUser } from "../../../admin-access";
import { getObjectStorage } from "../../../object-storage";

const confirmationPhrase = "NETTOYER";

export async function DELETE(request: Request) {
  const admin = await getAdminApiUser();
  if (!admin) return Response.json({ error: "Accès administrateur refusé." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { confirmation?: unknown };
  if (body.confirmation !== confirmationPhrase) return Response.json({ error: `Écrivez ${confirmationPhrase} pour confirmer.` }, { status: 400 });

  const db = getDb();
  const [requestCount, expertCount, postCount, feedbackCount, accountCount, documents, experts, posts, requests] = await Promise.all([
    db.select({ value: count() }).from(serviceRequests),
    db.select({ value: count() }).from(artisanApplications),
    db.select({ value: count() }).from(expertPosts),
    db.select({ value: count() }).from(feedbackEntries),
    db.select({ value: count() }).from(personalAccounts),
    db.select({ key: artisanDocuments.storageKey }).from(artisanDocuments),
    db.select({ profile: artisanApplications.profileImageKey, cover: artisanApplications.coverImageKey }).from(artisanApplications),
    db.select({ image: expertPosts.imageKey }).from(expertPosts),
    db.select({ problem: serviceRequests.problemImageKey, before: serviceRequests.beforeImageKey, after: serviceRequests.afterImageKey }).from(serviceRequests),
  ]);

  const storageKeys = [...new Set([
    ...documents.map((item) => item.key),
    ...experts.flatMap((item) => [item.profile, item.cover]),
    ...posts.map((item) => item.image),
    ...requests.flatMap((item) => [item.problem, item.before, item.after]),
  ].filter((key): key is string => Boolean(key)))];
  const bucket = getObjectStorage();
  if (storageKeys.length && !bucket) return Response.json({ error: "Le stockage des fichiers est momentanément indisponible. Aucune donnée n’a été supprimée." }, { status: 503 });
  if (bucket) {
    for (let index = 0; index < storageKeys.length; index += 1000) await bucket.delete(storageKeys.slice(index, index + 1000));
  }

  await db.delete(feedbackEntries);
  await db.delete(notifications);
  await db.delete(serviceRequests);
  await db.delete(artisanApplications);
  await db.delete(personalAccounts);

  return Response.json({
    ok: true,
    deleted: {
      requests: requestCount[0]?.value || 0,
      experts: expertCount[0]?.value || 0,
      posts: postCount[0]?.value || 0,
      feedback: feedbackCount[0]?.value || 0,
      accounts: accountCount[0]?.value || 0,
      files: storageKeys.length,
    },
  });
}
