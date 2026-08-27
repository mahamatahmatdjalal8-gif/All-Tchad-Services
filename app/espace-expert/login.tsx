"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type ApplicationStatus = {
  reference: string;
  name: string;
  trade: string;
  status: string;
  reviewNote: string | null;
};

const statusCopy: Record<string, { label: string; title: string; text: string; icon: string }> = {
  pending: { label: "En cours de vérification", title: "Votre dossier est bien reçu", text: "L’administration examine votre candidature. Revenez avec le même numéro pour connaître la décision.", icon: "⌛" },
  rejected: { label: "Décision disponible", title: "Candidature non acceptée", text: "Consultez le message de l’administration ci-dessous. Vous pouvez contacter le service pour obtenir de l’aide.", icon: "!" },
  suspended: { label: "Accès suspendu", title: "Votre espace est temporairement bloqué", text: "Contactez l’administration pour connaître la raison et les prochaines étapes.", icon: "!" },
};

export default function ExpertLogin() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const [application, setApplication] = useState<ApplicationStatus | null>(null);

  useEffect(() => {
    Promise.resolve().then(() => {
      try { setReference(window.localStorage.getItem("ats_last_artisan_reference") || ""); } catch { /* Le champ reste vide si le stockage est indisponible. */ }
    });
  }, []);

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/expert-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference }) });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Vérification impossible.");
    } else if (result.status === "accepted") {
      try { window.localStorage.setItem("ats_last_artisan_reference", reference); } catch { /* L’accès continue sans stockage local. */ }
      window.location.href = "/espace-expert?tab=profile";
      return;
    } else if (result.application) {
      setApplication(result.application);
      try { window.localStorage.setItem("ats_last_artisan_reference", result.application.reference); } catch { /* L’état reste visible à l’écran. */ }
    }
    setBusy(false);
  }

  const currentStatus = application ? (statusCopy[application.status] || statusCopy.pending) : null;

  return <main className="expert-login-page">
    <section className="expert-login-intro">
      <Link className="space-brand" href="/"><span>AT</span><div><strong>Allô Tchad</strong><small>Espace professionnel</small></div></Link>
      <div><span>Suivi et espace expert</span><h1>Votre activité,<br />dans votre poche.</h1><p>Suivez votre candidature puis, après acceptation, gérez vos demandes et publiez vos réalisations.</p><ul><li>✓ Un seul numéro à garder</li><li>✓ Aucun mot de passe</li><li>✓ Accès après acceptation</li></ul></div>
    </section>
    <section className="expert-login-panel">
      {!application ? <form onSubmit={connect}>
        <div className="expert-login-icon">♙</div>
        <span>Suivi expert</span>
        <h2>Retrouvez votre dossier</h2>
        <p>Entrez le numéro reçu après votre candidature.</p>
        <label>Numéro de suivi<input type="text" name="reference" value={reference} onChange={(event) => setReference(event.target.value.toUpperCase())} autoComplete="off" autoCapitalize="characters" placeholder="ART-…" required /></label>
        <small className="expert-login-help">Pas de compte ni de mot de passe. Gardez votre numéro privé.</small>
        {error && <small className="expert-login-error">{error}</small>}
        <button disabled={busy}>{busy ? "Vérification…" : "Vérifier mon dossier →"}</button>
        <small>Numéro perdu ? <Link href="/contact">Contactez l’administration</Link></small>
      </form> : <section className={`application-result application-${application.status}`}>
        <div className="application-result-icon" aria-hidden="true">{currentStatus?.icon}</div>
        <span>{currentStatus?.label}</span>
        <h2>{currentStatus?.title}</h2>
        <p>{currentStatus?.text}</p>
        <div className="application-result-reference"><small>{application.trade}</small><strong>{application.reference}</strong></div>
        {application.reviewNote && <aside><span>Message de l’administration</span><p>{application.reviewNote}</p></aside>}
        <button type="button" onClick={() => { setApplication(null); setError(""); }}>Vérifier un autre numéro</button>
        <Link href="/contact">Besoin d’aide ? Contacter le service</Link>
      </section>}
    </section>
  </main>;
}
