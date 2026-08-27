import { and, asc, desc, eq, or } from "drizzle-orm";
import { getDb } from "../../db";
import { artisanApplications, clientSessions, expertPosts, expertRelationships, feedbackEntries, postComments, postFavorites, postLikes, postReplies, postShares, postViews, requestMessages, serviceRequests } from "../../db/schema";
import { getExpertContext } from "../social-auth";
import ExpertWorkspace from "./workspace";
import "./expert-space.css";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ExpertSpacePage() {
  const context = await getExpertContext();
  if (!context) redirect("/profil");
  const db = getDb();
  const expert = context.expert;
  const canReceiveMissions = expert.status === "accepted";
  const [posts, requests, outgoingRequests, allFeedback, relationships, followingRelationships] = await Promise.all([
    db.select().from(expertPosts).where(eq(expertPosts.expertId, expert.id)).orderBy(desc(expertPosts.createdAt)).limit(100),
    canReceiveMissions ? db.select().from(serviceRequests).where(and(eq(serviceRequests.requestKind, "service"), or(eq(serviceRequests.targetExpertId, expert.id), eq(serviceRequests.assignedArtisan, expert.name)))).orderBy(desc(serviceRequests.createdAt)).limit(100) : Promise.resolve([]),
    db.select().from(serviceRequests).where(or(eq(serviceRequests.requesterExpertId, expert.id), eq(serviceRequests.targetExpertId, expert.id))).orderBy(desc(serviceRequests.createdAt)).limit(100),
    db.select().from(feedbackEntries).orderBy(desc(feedbackEntries.createdAt)).limit(1000),
    db.select().from(expertRelationships).where(eq(expertRelationships.expertId, expert.id)).limit(1000),
    db.select().from(expertRelationships).where(eq(expertRelationships.followerExpertId, expert.id)).limit(1000),
  ]);
  const postIds = new Set(posts.map((post) => post.id));
  const [allLikes, allComments, allReplies, allFavorites, allShares, allViews, acceptedExperts, clientIdentities, members] = await Promise.all([
    db.select().from(postLikes),
    db.select().from(postComments).orderBy(asc(postComments.createdAt)).limit(1000),
    db.select().from(postReplies).orderBy(asc(postReplies.createdAt)).limit(1000),
    db.select().from(postFavorites),
    db.select().from(postShares),
    db.select().from(postViews),
    db.select({ id: artisanApplications.id, name: artisanApplications.name }).from(artisanApplications),
    db.select({ sessionId: clientSessions.id, customerName: serviceRequests.customerName }).from(clientSessions).innerJoin(serviceRequests, eq(clientSessions.requestId, serviceRequests.id)).limit(1000),
    db.select({ id: artisanApplications.id, name: artisanApplications.name, status: artisanApplications.status, trade: artisanApplications.trade, area: artisanApplications.area }).from(artisanApplications).orderBy(asc(artisanApplications.name)).limit(1000),
  ]);
  const expertNames = new Map(acceptedExperts.map((item) => [item.id, item.name]));
  const clientNames = new Map(clientIdentities.map((item) => [item.sessionId, item.customerName]));
  const commentsWithNames = allComments.map((comment) => ({ ...comment, customerName: comment.expertId ? expertNames.get(comment.expertId) || "Expert" : comment.sessionId ? clientNames.get(comment.sessionId) || "Client" : "Membre" }));
  const postsWithMetrics = posts.map((post) => ({
    ...post,
    likeCount: allLikes.filter((item) => postIds.has(item.postId) && item.postId === post.id).length,
    commentCount: commentsWithNames.filter((item) => postIds.has(item.postId) && item.postId === post.id).length,
    comments: commentsWithNames.filter((item) => item.postId === post.id).map((comment) => ({ ...comment, replies: allReplies.filter((reply) => reply.commentId === comment.id) })),
    favoriteCount: allFavorites.filter((item) => postIds.has(item.postId) && item.postId === post.id).length,
    shareCount: allShares.filter((item) => postIds.has(item.postId) && item.postId === post.id).length,
    viewCount: allViews.filter((item) => postIds.has(item.postId) && item.postId === post.id).length,
  }));
  const requestIds = new Set([...requests.filter((item) => item.requesterExpertId), ...outgoingRequests].map((item) => item.id));
  const messages = (await db.select().from(requestMessages).orderBy(asc(requestMessages.createdAt)).limit(1000)).filter((message) => requestIds.has(message.requestId));
  const requestReferences = new Set(requests.map((item) => item.reference));
  const reviews = allFeedback.filter((item) => item.kind === "review" && item.requestReference && requestReferences.has(item.requestReference));
  const followerCount = relationships.filter((item) => item.follows).length;
  const followingCount = followingRelationships.filter((item) => item.follows).length;
  const favoriteCount = relationships.filter((item) => item.favorite).length;
  const initialData = JSON.parse(JSON.stringify({ expert, posts: postsWithMetrics, requests, outgoingRequests, messages, reviews, members: members.filter((member) => member.id !== expert.id), followerCount, followingCount, favoriteCount }));
  return <ExpertWorkspace initialData={initialData} />;
}
