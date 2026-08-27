"use client";

import { FormEvent, useEffect, useState } from "react";
import { Bookmark, MessageCircle, UserCheck, UserPlus, Wrench } from "lucide-react";

type ExpertSummary = { id: number; name: string; trade: string; area: string };

export default function PublicExpertActions({ expert }: { expert: ExpertSummary }) {
  const [identity, setIdentity] = useState<{ authenticated: boolean; actorType?: string; expertId?: number | null; followedExpertIds?: number[]; favoriteExpertIds?: number[] }>({ authenticated: false });
  const [followed, setFollowed] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ conversationUrl: string } | null>(null);

  useEffect(() => {
    fetch("/api/social/me").then((response) => response.json()).then((data) => {
      setIdentity(data);
      setFollowed((data.followedExpertIds ?? []).includes(expert.id));
      setFavorite((data.favoriteExpertIds ?? []).includes(expert.id));
      if (new URLSearchParams(window.location.search).get("demande") === "1") {
        if (data.actorType === "expert") setShowRequest(true);
        else window.location.assign(`/profil?returnTo=${encodeURIComponent(`/experts/${expert.id}?demande=1`)}`);
      }
    }).catch(() => undefined);
  }, [expert.id]);

  const ownProfile = identity.actorType === "expert" && identity.expertId === expert.id;

  async function toggle(action: "follow" | "favorite") {
    if (!identity.authenticated) { window.location.assign("/profil"); return; }
    setBusy(action);
    const response = await fetch("/api/social/interact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, expertId: expert.id }) });
    const result = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) { setError(result.error || "Action impossible."); return; }
    if (action === "follow") setFollowed(Boolean(result.active));
    else setFavorite(Boolean(result.active));
  }

  function openRequest() {
    if (identity.actorType !== "expert") { window.location.assign(`/profil?returnTo=${encodeURIComponent(`/experts/${expert.id}?demande=1`)}`); return; }
    setError(""); setSuccess(null); setShowRequest(true);
  }

  async function sendRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("request"); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/expert/service-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, targetExpertId: expert.id }) });
    const result = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) { setError(result.error || "Envoi impossible."); return; }
    setSuccess({ conversationUrl: result.conversationUrl || "/espace-expert?tab=messages" });
  }

  return <>
    <div className="public-profile-actions" aria-label="Actions sur le profil">
      {ownProfile ? <a className="primary" href="/espace-expert?tab=profile"><Wrench /> Gérer mon profil</a> : <>
        <button className={followed ? "primary active" : "primary"} disabled={busy === "follow"} onClick={() => toggle("follow")}>{followed ? <UserCheck /> : <UserPlus />}{followed ? "Abonné" : "Suivre"}</button>
        <button className={favorite ? "active" : ""} disabled={busy === "favorite"} onClick={() => toggle("favorite")}><Bookmark />{favorite ? "Enregistré" : "Favori"}</button>
        <button onClick={openRequest}><MessageCircle /> Demander un service</button>
      </>}
    </div>
    {error && !showRequest && <p className="public-profile-error">{error}</p>}
    {showRequest && <div className="expert-request-modal" onMouseDown={(event) => event.target === event.currentTarget && setShowRequest(false)}>
      <form onSubmit={sendRequest}><button type="button" className="close" onClick={() => setShowRequest(false)} aria-label="Fermer">×</button>{success ? <div className="request-success"><b>✓</b><span>Conversation créée avec {expert.name}</span><h2>Demande envoyée</h2><p>Votre échange est disponible dans la messagerie. La demande apparaît immédiatement chez {expert.name} et deviendra une mission dès son acceptation.</p><a href={success.conversationUrl}>Ouvrir la conversation →</a></div> : <><span>Demande directe</span><h2>Contacter {expert.name}</h2><p>Votre message crée directement une conversation privée. Aucun numéro de suivi n’est nécessaire.</p><label>Lieu de l’intervention<input name="district" defaultValue={expert.area} maxLength={120} required /></label><label>Urgence<select name="urgency" defaultValue="Normal"><option>Normal</option><option>Urgent</option><option>Sur rendez-vous</option></select></label><label>Votre besoin<textarea name="details" minLength={10} maxLength={800} rows={5} placeholder={`Exemple : j’ai besoin de votre compétence en ${expert.trade.toLowerCase()}…`} required /></label>{error && <small>{error}</small>}<button className="send" disabled={busy === "request"}>{busy === "request" ? "Envoi…" : "Envoyer et discuter →"}</button></>}</form>
    </div>}
  </>;
}
