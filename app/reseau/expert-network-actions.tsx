"use client";

import { useRef, useState } from "react";
import { Bell, Check, ChevronRight, Heart, MessageCircle, UsersRound, Briefcase, X } from "lucide-react";

type ExpertActionsData = {
  id: number;
  name: string;
  hasProfilePhoto: boolean;
  messageCount: number;
  notifications: { id: string; icon: string; title: string; detail: string; href: string; read?: boolean; createdAt?: string }[];
};

function NoticeIcon({ icon }: { icon: string }) {
  if (icon === "💬") return <MessageCircle aria-hidden="true" />;
  if (icon === "♥") return <Heart aria-hidden="true" />;
  if (icon === "👥") return <UsersRound aria-hidden="true" />;
  if (icon === "✓") return <Check aria-hidden="true" />;
  if (icon === "!") return <Briefcase aria-hidden="true" />;
  return <Bell aria-hidden="true" />;
}

export default function ExpertNetworkActions({ data }: { data: ExpertActionsData }) {
  const panel = useRef<HTMLDetailsElement>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [readIds, setReadIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isUnread = (item: ExpertActionsData["notifications"][number]) => item.read === false && !readIds.includes(item.id);
  const count = data.notifications.filter(isUnread).length;
  const visible = data.notifications.filter((item) => filter === "all" || isUnread(item));

  function closePanel() {
    if (panel.current) {
      panel.current.open = false;
      panel.current.querySelector("summary")?.focus();
    }
  }

  async function markAllRead() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/notifications", { method: "PATCH", signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("read failed");
      setReadIds(data.notifications.filter((item) => item.read !== undefined).map((item) => item.id));
    } catch {
      setError("Impossible de mettre à jour les notifications. Réessayez.");
    } finally { setBusy(false); }
  }

  return <div className="network-expert-actions" aria-label="Outils de l’expert">
    <a className="network-round-action" href="/espace-expert?tab=messages" aria-label="Ouvrir la messagerie"><MessageCircle aria-hidden="true" />{data.messageCount > 0 && <b>{data.messageCount}</b>}</a>
    <details ref={panel} className="network-notifications notifications-refreshed" onKeyDown={(event) => { if (event.key === "Escape") closePanel(); }}>
      <summary className="network-round-action" aria-label={count ? `Notifications : ${count} non lues` : "Voir les notifications"}><Bell aria-hidden="true" />{count > 0 && <b>{count}</b>}</summary>
      <div className="notification-panel">
        <header><strong>Notifications</strong>{count > 0 && <small>{count} nouvelle{count > 1 ? "s" : ""}</small>}<button type="button" onClick={closePanel} aria-label="Fermer les notifications"><X aria-hidden="true" /></button></header>
        {data.notifications.length > 0 && <nav aria-label="Filtrer les notifications"><button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>Toutes</button><button type="button" aria-pressed={filter === "unread"} onClick={() => setFilter("unread")}>Non lues</button></nav>}
        <div className="notification-rows">{visible.map((item) => <a className={isUnread(item) ? "notification-row unread" : "notification-row"} href={item.href} key={item.id}>
          <span className="notification-icon"><NoticeIcon icon={item.icon} /></span><span className="notification-copy"><strong>{item.title}</strong><span>{item.detail}</span>{item.createdAt ? <time dateTime={item.createdAt}>{new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Ndjamena" }).format(new Date(item.createdAt))}</time> : <small>À suivre</small>}</span>{isUnread(item) && <i className="notification-dot" aria-label="Non lue" />}<ChevronRight aria-hidden="true" />
        </a>)}</div>
        {visible.length === 0 && <section className="notification-empty"><span><Bell aria-hidden="true" /><Check aria-hidden="true" /></span><strong>Vous êtes à jour</strong><p>{filter === "unread" ? "Vous n’avez aucune notification non lue." : "Vos nouvelles demandes, messages et réactions apparaîtront ici."}</p></section>}
        {error && <p className="notification-error" role="alert">{error}</p>}
        {count > 0 && <button className="notification-mark-read" type="button" onClick={markAllRead} disabled={busy}>{busy ? "Mise à jour…" : "Tout marquer comme lu"}</button>}
      </div>
    </details>
    <a className="network-profile-action" href="/espace-expert?tab=profile" aria-label="Ouvrir mon profil">{data.hasProfilePhoto ? <img src={`/api/expert/profile-photo?id=${data.id}`} alt={`Photo de ${data.name}`} /> : <span>{data.name.slice(0, 1).toUpperCase()}</span>}<i aria-hidden="true">⌄</i></a>
  </div>;
}
