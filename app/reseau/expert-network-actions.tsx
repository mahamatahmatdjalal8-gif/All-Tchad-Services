"use client";

type ExpertActionsData = {
  id: number;
  name: string;
  hasProfilePhoto: boolean;
  messageCount: number;
  notifications: { id: string; icon: string; title: string; detail: string; href: string }[];
};

export default function ExpertNetworkActions({ data }: { data: ExpertActionsData }) {
  const count = data.notifications.length;
  return <div className="network-expert-actions" aria-label="Outils de l’expert">
    <a className="network-round-action" href="/espace-expert?tab=messages" aria-label="Ouvrir la messagerie"><span aria-hidden="true">💬</span>{data.messageCount > 0 && <b>{data.messageCount}</b>}</a>
    <details className="network-notifications">
      <summary className="network-round-action" aria-label="Voir les notifications"><span aria-hidden="true">🔔</span>{count > 0 && <b>{count}</b>}</summary>
      <div><header><strong>Notifications</strong><small>{count} nouvelle{count > 1 ? "s" : ""}</small></header>{data.notifications.map((item) => <a href={item.href} key={item.id}><b>{item.icon}</b><span><strong>{item.title}</strong><small>{item.detail}</small></span></a>)}{count === 0 && <p>Votre espace est à jour.</p>}</div>
    </details>
    <a className="network-profile-action" href="/espace-expert?tab=profile" aria-label="Ouvrir mon profil">{data.hasProfilePhoto ? <img src={`/api/expert/profile-photo?id=${data.id}`} alt={`Photo de ${data.name}`} /> : <span>{data.name.slice(0, 1).toUpperCase()}</span>}<i aria-hidden="true">⌄</i></a>
  </div>;
}
