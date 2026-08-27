"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type Application = {
  reference: string; name: string; phone: string; trade: string; area: string; coverage: string;
  experience: number; availability: string; proof: string; workExamples: string;
  workshopAddress: string | null; status: string; reviewNote: string | null; createdAt: string;
};

const statusContent: Record<string, { label: string; title: string; text: string }> = {
  pending: { label: "En cours de vérification", title: "Votre dossier est bien reçu", text: "L’administration contrôle vos informations avant de rendre sa décision." },
  rejected: { label: "À corriger", title: "Votre dossier nécessite une correction", text: "Consultez la remarque ci-dessous, corrigez les informations puis renvoyez le dossier." },
};

export default function CandidateWorkspace({ application, signOutPath }: { application: Application; signOutPath: string }) {
  const [editing, setEditing] = useState(application.status === "rejected");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const status = statusContent[application.status] ?? statusContent.pending;

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setNotice("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/expert/application", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    const result = await response.json();
    setNotice(response.ok ? "Dossier corrigé et renvoyé à l’administration." : result.error || "La correction est impossible pour le moment.");
    if (response.ok) setEditing(false);
    setBusy(false);
  }

  return <main className="candidate-space">
    <header><Link className="space-brand" href="/"><span>AT</span><div><strong>Allô Tchad</strong><small>Espace candidat</small></div></Link><a href={signOutPath}>Se déconnecter</a></header>
    <section className="candidate-shell">
      <div className="candidate-title"><span>Candidature {application.reference}</span><h1>Bonjour, {application.name}</h1><p>Suivez votre dossier et complétez-le sans passer par WhatsApp.</p></div>
      <section className={`candidate-status-card status-${application.status}`}><div className="candidate-status-icon">{application.status === "rejected" ? "!" : "✓"}</div><div><span>{status.label}</span><h2>{status.title}</h2><p>{status.text}</p></div></section>
      <ol className="candidate-timeline"><li className="done"><b>1</b><span><strong>Dossier envoyé</strong><small>Informations et preuves reçues</small></span></li><li className={application.status === "rejected" ? "alert" : "active"}><b>2</b><span><strong>Contrôle administratif</strong><small>Identité, expérience et références</small></span></li><li><b>3</b><span><strong>Décision</strong><small>Acceptation ou demande de correction</small></span></li><li><b>4</b><span><strong>Profil publié</strong><small>Accès à l’espace professionnel</small></span></li></ol>
      {application.reviewNote && <aside className="candidate-review-note"><span>Message de l’administration</span><p>{application.reviewNote}</p></aside>}
      <section className="candidate-file"><header><div><span>Résumé du dossier</span><h2>{application.trade}</h2></div><button onClick={() => setEditing((value) => !value)}>{editing ? "Fermer" : "Corriger mon dossier"}</button></header>
        {!editing ? <dl><div><dt>Téléphone</dt><dd>{application.phone}</dd></div><div><dt>Ville et quartier</dt><dd>{application.area}</dd></div><div><dt>Zone d’intervention</dt><dd>{application.coverage}</dd></div><div><dt>Expérience</dt><dd>{application.experience} an(s)</dd></div><div><dt>Disponibilité</dt><dd>{application.availability}</dd></div><div><dt>Atelier</dt><dd>{application.workshopAddress || "Non renseigné"}</dd></div></dl> :
        <form className="candidate-edit-form" onSubmit={update}><label>Numéro WhatsApp<input name="phone" defaultValue={application.phone} required /></label><label>Ville et quartier<input name="area" defaultValue={application.area} required /></label><label>Zones d’intervention<textarea name="coverage" defaultValue={application.coverage} required /></label><label>Disponibilité<input name="availability" defaultValue={application.availability} required /></label><label>Adresse de l’atelier<input name="workshopAddress" defaultValue={application.workshopAddress || ""} /></label><label>Exemples de travaux<textarea name="workExamples" defaultValue={application.workExamples} required /></label><label>Preuves disponibles<textarea name="proof" defaultValue={application.proof} required /></label><button disabled={busy}>{busy ? "Envoi…" : "Renvoyer le dossier →"}</button></form>}
        {notice && <p className="candidate-notice">{notice}</p>}
      </section>
      <p className="candidate-help">Besoin d’aide ? <Link href="/contact">Contacter le service</Link></p>
    </section>
  </main>;
}
