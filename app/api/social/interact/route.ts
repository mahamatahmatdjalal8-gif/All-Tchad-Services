import { and, count, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { artisanApplications, expertPosts, expertRelationships, feedbackEntries, postComments, postFavorites, postLikes, postReports } from "../../../../db/schema";
import { getSocialActor } from "../../../social-auth";
import { createNotification } from "../../../notification-service";

const clean = (value: unknown, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(request: Request) {
  const actor = await getSocialActor();
  if (!actor || actor.kind !== "expert") return Response.json({ error: "Connectez-vous avec un compte expert." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = clean(body.action, 30);
  const postId = Number(body.postId);
  const expertId = Number(body.expertId);
  const db = getDb();

  if (action === "like" && Number.isInteger(postId) && postId > 0) {
    const [post] = await db.select({ id: expertPosts.id, expertId: expertPosts.expertId }).from(expertPosts).where(eq(expertPosts.id, postId)).limit(1);
    if (!post) return Response.json({ error: "Publication introuvable." }, { status: 404 });
    if (actor.expertId === post.expertId) return Response.json({ error: "Vous ne pouvez pas aimer votre propre publication." }, { status: 409 });
    const actorFilter = eq(postLikes.expertId, actor.expertId);
    const [existing] = await db.select().from(postLikes).where(and(eq(postLikes.postId, postId), actorFilter)).limit(1);
    if (existing) await db.delete(postLikes).where(eq(postLikes.id, existing.id));
    else {
      await db.insert(postLikes).values({ postId, sessionId: null, expertId: actor.expertId });
      await createNotification({ recipientType: "expert", recipientId: post.expertId, kind: "post_like", title: "Nouvelle mention J’aime", body: `${actor.name} aime votre publication.` });
    }
    return Response.json({ active: !existing });
  }

  if (action === "comment" && Number.isInteger(postId) && postId > 0) {
    const content = clean(body.content, 500);
    if (content.length < 2) return Response.json({ error: "Écrivez un commentaire." }, { status: 400 });
    const [post] = await db.select({ id: expertPosts.id, expertId: expertPosts.expertId }).from(expertPosts).where(eq(expertPosts.id, postId)).limit(1);
    if (!post) return Response.json({ error: "Publication introuvable." }, { status: 404 });
    const [row] = await db.insert(postComments).values({ postId, sessionId: null, expertId: actor.expertId, body: content }).returning({ id: postComments.id, body: postComments.body, createdAt: postComments.createdAt });
    if (actor.expertId !== post.expertId) await createNotification({ recipientType: "expert", recipientId: post.expertId, kind: "post_comment", title: "Nouveau commentaire", body: `${actor.name} : ${content.slice(0, 120)}` });
    return Response.json({ comment: { ...row, customerName: actor.name } }, { status: 201 });
  }

  if (action === "report-post" && Number.isInteger(postId) && postId > 0) {
    const reason = clean(body.reason, 500);
    if (reason.length < 5) return Response.json({ error: "Indiquez la raison du signalement." }, { status: 400 });
    const [post] = await db.select({ id: expertPosts.id }).from(expertPosts).where(eq(expertPosts.id, postId)).limit(1);
    if (!post) return Response.json({ error: "Publication introuvable." }, { status: 404 });
    const actorFilter = eq(postReports.expertId, actor.expertId);
    const [existing] = await db.select({ id: postReports.id }).from(postReports).where(and(eq(postReports.postId, postId), actorFilter)).limit(1);
    if (existing) return Response.json({ error: "Vous avez déjà signalé cette publication." }, { status: 409 });
    await db.insert(postReports).values({ postId, sessionId: null, expertId: actor.expertId, reason });
    await db.insert(feedbackEntries).values({ reference: `POST-${postId}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`, requestReference: `PUBLICATION-${postId}`, kind: "complaint", customerName: actor.name, customerPhone: actor.phone, details: reason });
    const [total] = await db.select({ value: count() }).from(postReports).where(eq(postReports.postId, postId));
    if ((total?.value || 0) >= 3) await db.update(expertPosts).set({ moderationStatus: "under_review", updatedAt: new Date() }).where(eq(expertPosts.id, postId));
    return Response.json({ ok: true, underReview: (total?.value || 0) >= 3 });
  }

  if (action === "favorite-post" && Number.isInteger(postId) && postId > 0) {
    const [post] = await db.select({ id: expertPosts.id }).from(expertPosts).where(eq(expertPosts.id, postId)).limit(1);
    if (!post) return Response.json({ error: "Publication introuvable." }, { status: 404 });
    const actorFilter = eq(postFavorites.expertId, actor.expertId);
    const [existing] = await db.select().from(postFavorites).where(and(eq(postFavorites.postId, postId), actorFilter)).limit(1);
    if (existing) await db.delete(postFavorites).where(eq(postFavorites.id, existing.id));
    else await db.insert(postFavorites).values({ postId, sessionId: null, expertId: actor.expertId });
    return Response.json({ active: !existing });
  }

  if ((action === "follow" || action === "favorite") && Number.isInteger(expertId) && expertId > 0) {
    const [expert] = await db.select({ id: artisanApplications.id }).from(artisanApplications).where(and(eq(artisanApplications.id, expertId), eq(artisanApplications.status, "accepted"))).limit(1);
    if (!expert) return Response.json({ error: "Expert introuvable." }, { status: 404 });
    if (actor.expertId === expertId) return Response.json({ error: "Cette action concerne les autres experts." }, { status: 409 });
    const actorFilter = eq(expertRelationships.followerExpertId, actor.expertId);
    const [existing] = await db.select().from(expertRelationships).where(and(eq(expertRelationships.expertId, expertId), actorFilter)).limit(1);
    const current = action === "follow" ? Boolean(existing?.follows) : Boolean(existing?.favorite);
    if (existing) await db.update(expertRelationships).set({ [action === "follow" ? "follows" : "favorite"]: !current, updatedAt: new Date() }).where(eq(expertRelationships.id, existing.id));
    else await db.insert(expertRelationships).values({ expertId, sessionId: null, followerExpertId: actor.expertId, follows: action === "follow", favorite: action === "favorite" });
    if (action === "follow" && !current) await createNotification({ recipientType: "expert", recipientId: expertId, kind: "new_follower", title: "Nouvel abonné", body: `${actor.name} suit maintenant votre profil professionnel.` });
    return Response.json({ active: !current });
  }

  return Response.json({ error: "Action invalide." }, { status: 400 });
}
