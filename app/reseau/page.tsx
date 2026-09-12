import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "../../db";
import { notifications as notificationRows, requestMessages, serviceRequests } from "../../db/schema";
import AppBottomNav from "../app-bottom-nav";
import { getExpertContext } from "../social-auth";
import { getPublicSocialData } from "../social-data";
import ExpertNetworkActions from "./expert-network-actions";
import SocialFeed from "./social-feed";
import "./reseau.css";

export const dynamic = "force-dynamic";

export default async function NetworkPage() {
  const db = getDb();
  const expertContext = await getExpertContext();
  const initialData = JSON.parse(JSON.stringify(await getPublicSocialData()));

  let expertActions = null;
  if (expertContext) {
    const assignedRequests = await db.select().from(serviceRequests).where(eq(serviceRequests.assignedArtisan, expertContext.expert.name)).orderBy(desc(serviceRequests.createdAt)).limit(100);
    const outgoingRequests = await db.select({ id: serviceRequests.id }).from(serviceRequests).where(eq(serviceRequests.requesterExpertId, expertContext.expert.id)).orderBy(desc(serviceRequests.createdAt)).limit(100);
    const requestIds = new Set([...assignedRequests.filter((item) => item.requesterExpertId), ...outgoingRequests].map((item) => item.id));
    const recentMessages = (await db.select().from(requestMessages).orderBy(desc(requestMessages.createdAt)).limit(500)).filter((message) => requestIds.has(message.requestId) && message.senderType !== "system" && (message.senderExpertId ? message.senderExpertId !== expertContext.expert.id : message.senderType === "client")).slice(0, 3);
    const waiting = assignedRequests.filter((item) => item.expertDecision === "pending" && item.status !== "cancelled");
    const accepted = assignedRequests.filter((item) => item.quoteStatus === "accepted" && item.status === "assigned");
    const socialNotices = await db.select().from(notificationRows).where(and(eq(notificationRows.recipientType, "expert"), eq(notificationRows.recipientId, expertContext.expert.id))).orderBy(desc(notificationRows.createdAt)).limit(8);
    const notifications = [
      ...socialNotices.map((notice) => ({ id: `notice-${notice.id}`, icon: notice.kind.includes("comment") ? "💬" : notice.kind.includes("like") ? "♥" : notice.kind.includes("follower") ? "👥" : "🔔", read: Boolean(notice.readAt), createdAt: notice.createdAt.toISOString(), title: notice.title, detail: notice.body.slice(0, 70), href: notice.requestId ? `/espace-expert?tab=missions&request=${notice.requestId}` : "/reseau" })),
      ...waiting.slice(0, 2).map((item) => ({ id: `mission-${item.id}`, icon: "!", title: "Nouvelle mission", detail: `${item.service} · ${item.district}`, href: `/espace-expert?tab=missions&request=${item.id}` })),
      ...accepted.slice(0, 2).map((item) => ({ id: `quote-${item.id}`, icon: "✓", title: "Devis accepté", detail: `${item.service} · intervention prête`, href: `/espace-expert?tab=missions&request=${item.id}` })),
      ...recentMessages.map((message) => ({ id: `message-${message.id}`, icon: "💬", title: `Message de ${message.senderName}`, detail: message.body.slice(0, 55), href: `/espace-expert?tab=messages&request=${message.requestId}` })),
    ].slice(0, 6);
    expertActions = { id: expertContext.expert.id, name: expertContext.expert.name, hasProfilePhoto: Boolean(expertContext.expert.profileImageKey), messageCount: recentMessages.length, notifications };
  }

  return <main className="network-page professional-home">
    <header className="network-header"><Link className="network-brand" href="/"><span>AT</span><div><strong>Allô Tchad</strong><small>Réalisations</small></div></Link>{expertActions ? <ExpertNetworkActions data={expertActions} /> : <nav><Link href="/experts">Trouver un expert</Link><Link className="expert-space-link" href="/profil">Mon espace</Link></nav>}</header>
    <SocialFeed initialData={initialData} />
    <AppBottomNav active="realizations" />
  </main>;
}
