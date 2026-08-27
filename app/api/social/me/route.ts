import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { expertRelationships, postFavorites, postLikes } from "../../../../db/schema";
import { getSocialActor } from "../../../social-auth";

export async function GET() {
  const actor = await getSocialActor();
  if (!actor || actor.kind !== "expert") return Response.json({ authenticated: false });
  const likeFilter = eq(postLikes.expertId, actor.expertId);
  const favoritePostFilter = eq(postFavorites.expertId, actor.expertId);
  const relationshipFilter = eq(expertRelationships.followerExpertId, actor.expertId);
  const [likes, favoritePosts, relationships] = await Promise.all([
    getDb().select({ postId: postLikes.postId }).from(postLikes).where(likeFilter),
    getDb().select({ postId: postFavorites.postId }).from(postFavorites).where(favoritePostFilter),
    getDb().select().from(expertRelationships).where(relationshipFilter),
  ]);
  return Response.json({
    authenticated: true,
    actorType: "expert",
    expertId: actor.expertId,
    customerName: actor.name,
    likedPostIds: likes.map((item) => item.postId),
    favoritePostIds: favoritePosts.map((item) => item.postId),
    followedExpertIds: relationships.filter((item) => item.follows).map((item) => item.expertId),
    favoriteExpertIds: relationships.filter((item) => item.favorite).map((item) => item.expertId),
  });
}
