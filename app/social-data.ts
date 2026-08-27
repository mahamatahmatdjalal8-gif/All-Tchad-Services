import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { artisanApplications, clientSessions, expertPosts, expertRelationships, postComments, postFavorites, postLikes, postReplies, postShares, postViews, serviceRequests } from "../db/schema";

export async function getPublicSocialData(options: { expertId?: number } = {}) {
  const db = getDb();
  const postFilter = options.expertId
    ? and(eq(expertPosts.moderationStatus, "published"), eq(expertPosts.expertId, options.expertId))
    : eq(expertPosts.moderationStatus, "published");
  const [experts, socialActors, posts, likes, comments, replies, relationships, favoritePosts, shares, views, clientIdentities] = await Promise.all([
    db.select({ id: artisanApplications.id, name: artisanApplications.name, trade: artisanApplications.trade, area: artisanApplications.area, coverage: artisanApplications.coverage, experience: artisanApplications.experience, availability: artisanApplications.availability, profileBio: artisanApplications.profileBio, workshopAddress: artisanApplications.workshopAddress, workingHours: artisanApplications.workingHours, profileImageKey: artisanApplications.profileImageKey, coverImageKey: artisanApplications.coverImageKey }).from(artisanApplications).where(eq(artisanApplications.status, "accepted")).orderBy(asc(artisanApplications.name)),
    db.select({ id: artisanApplications.id, name: artisanApplications.name }).from(artisanApplications),
    db.select().from(expertPosts).where(postFilter).orderBy(desc(expertPosts.createdAt)).limit(100),
    db.select().from(postLikes),
    db.select().from(postComments).orderBy(asc(postComments.createdAt)).limit(1000),
    db.select().from(postReplies).orderBy(asc(postReplies.createdAt)).limit(1000),
    db.select().from(expertRelationships),
    db.select().from(postFavorites),
    db.select().from(postShares),
    db.select().from(postViews),
    db.select({ sessionId: clientSessions.id, customerName: serviceRequests.customerName }).from(clientSessions).innerJoin(serviceRequests, eq(clientSessions.requestId, serviceRequests.id)).limit(1000),
  ]);

  const publicExperts = experts.map(({ profileImageKey, coverImageKey, ...expert }) => ({ ...expert, hasProfilePhoto: Boolean(profileImageKey), hasCoverPhoto: Boolean(coverImageKey) }));
  const expertNames = new Map(socialActors.map((expert) => [expert.id, expert.name]));
  const clientNames = new Map(clientIdentities.map((identity) => [identity.sessionId, identity.customerName]));
  const postCards = posts.map((post) => ({
    ...post,
    expert: publicExperts.find((expert) => expert.id === post.expertId) ?? null,
    likeCount: likes.filter((like) => like.postId === post.id).length,
    favoriteCount: favoritePosts.filter((favorite) => favorite.postId === post.id).length,
    shareCount: shares.filter((share) => share.postId === post.id).length,
    viewCount: views.filter((view) => view.postId === post.id).length,
    comments: comments.filter((comment) => comment.postId === post.id).map((comment) => ({ ...comment, customerName: comment.expertId ? expertNames.get(comment.expertId) || "Expert" : comment.sessionId ? clientNames.get(comment.sessionId) || "Client" : "Membre", replies: replies.filter((reply) => reply.commentId === comment.id) })),
  })).filter((post) => post.expert);
  const expertCards = publicExperts.map((expert) => ({
    ...expert,
    followerCount: relationships.filter((relation) => relation.expertId === expert.id && relation.follows).length,
    followingCount: relationships.filter((relation) => relation.followerExpertId === expert.id && relation.follows).length,
  }));
  return { posts: postCards, experts: expertCards };
}
