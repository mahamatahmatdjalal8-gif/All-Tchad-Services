"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bookmark, MessageCircle, UserCheck, UserPlus, Wrench } from "lucide-react";

type ExpertSummary = { id: number; name: string; trade: string; area: string };

export default function PublicExpertActions({ expert }: { expert: ExpertSummary }) {
  const [identity, setIdentity] = useState<{ authenticated: boolean; actorType?: string; expertId?: number | null; followedExpertIds?: number[]; favoriteExpertIds?: number[] }>({ authenticated: false });
  const [followed, setFollowed] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ missionUrl: string } | null>(null);
  const requestInFlight = useRef(false);

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
    event.preventDefault();
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy("request"); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch("/api/expert/service-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, targetExpertId: expert.id }), signal: controller.signal });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setError(result.error || "Envoi impossible. Votre demande est conservée dans ce formulaire."); return; }
      if (!Number.isInteger(result.requestId) || result.requestId < 1) {
        setError("La confirmation n’a pas pu être affichée. Consultez Mes missions avant de renvoyer la demande.");
        return;
      }
      setSuccess({ missionUrl: `/espace-expert?tab=missions&request=${result.requestId}` });
    } catch {
      setError("L’envoi n’a pas pu être confirmé. Consultez Mes missions avant de réessayer ; votre texte est conservé ici.");
    } finally {
      window.clearTimeout(timeout);
      requestInFlight.current = false;
      setBusy("");
    }
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
      <form onSubmit={sendRequest}><button type="button" className="close" onClick={() => setShowRequest(false)} aria-label="Fermer">×</button>{success ? <div className="request-success"><b>✓</b><span>En attente de la réponse de {expert.name}</span><h2>Demande envoyée</h2><p>{expert.name} peut maintenant accepter ou refuser votre mission. Dès son acceptation, votre conversation s’ouvre pour convenir du prix, du rendez-vous et des détails de l’intervention.</p><a href={success.missionUrl}>Suivre ma demande →</a></div> : <><span>Demander un service</span><h2>Votre demande à {expert.name}</h2><p>Décrivez votre besoin et le quartier. La discussion s’ouvrira dès que l’expert aura accepté la mission.</p><label>Ville ou quartier de l’intervention<input name="district" defaultValue={expert.area} maxLength={120} required /></label><label>Urgence<select name="urgency" defaultValue="Normal"><option>Normal</option><option>Urgent</option><option>Sur rendez-vous</option></select></label><label>Votre besoin<textarea name="details" minLength={10} maxLength={800} rows={5} placeholder={`Exemple : j’ai besoin de votre compétence en ${expert.trade.toLowerCase()}…`} required /></label>{error && <small role="alert">{error}</small>}<button className="send" disabled={busy === "request"}>{busy === "request" ? "Envoi…" : "Envoyer ma demande →"}</button></>}</form>
    </div>}
  </>;
}
