"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type ServiceRequest = {
  id: number; reference: string; customerName: string; customerPhone: string; service: string;
  city: string; district: string; urgency: string; details: string; status: string;
  assignedArtisan: string | null; commissionAmount: number; commissionStatus: string; createdAt: string;
};
type Artisan = {
  id: number; reference: string; name: string; phone: string; trade: string; area: string;
  loginEmail: string | null;
  coverage: string; experience: number; availability: string; proof: string; workExamples: string;
  identityType: string | null; identityNumber: string | null; workshopAddress: string | null;
  referenceOneName: string | null; referenceOnePhone: string | null; referenceTwoName: string | null; referenceTwoPhone: string | null;
  documents: Array<{ id: number; applicationId: number; kind: string; originalName: string; contentType: string; size: number }>;
  status: string; reviewNote: string | null; createdAt: string;
};
type Feedback = {
  id: number; reference: string; requestReference: string | null; kind: string; customerName: string;
  customerPhone: string; rating: number | null; details: string; status: string; createdAt: string;
};
type AdminData = { requests: ServiceRequest[]; artisans: Artisan[]; feedback: Feedback[] };

const labels: Record<string, string> = {
  new: "Nouvelle", assigned: "Assignée", in_progress: "En cours", completed: "Terminée", cancelled: "Annulée",
  pending: "À vérifier", accepted: "Accepté", rejected: "Refusé", suspended: "Suspendu",
  open: "Ouvert", in_review: "En traitement", resolved: "Résolu",
};

const statusOptions = {
  request: ["new", "assigned", "in_progress", "completed", "cancelled"],
  artisan: ["pending", "accepted", "rejected", "suspended"],
  feedback: ["open", "in_review", "resolved"],
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

const documentLabels: Record<string, string> = {
  identity_front: "Pièce d’identité · recto",
  identity_back: "Pièce d’identité · verso",
  identity_selfie: "Photo avec la pièce",
  work_photo_1: "Travail réalisé · photo 1",
  work_photo_2: "Travail réalisé · photo 2",
  work_photo_3: "Travail réalisé · photo 3",
  work_photo_4: "Travail réalisé · photo 4",
  work_photo_5: "Travail réalisé · photo 5",
  certificate: "Diplôme ou certificat",
};

function fileSizeLabel(size: number) {
  return size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} Mo` : `${Math.ceil(size / 1024)} Ko`;
}

function StatusSelect({ type, id, value, onChange, busy }: { type: keyof typeof statusOptions; id: number; value: string; onChange: (type: keyof typeof statusOptions, id: number, status: string) => void; busy: boolean }) {
  return (
    <select className={`admin-status status-${value}`} value={value} disabled={busy} onChange={(event) => onChange(type, id, event.target.value)} aria-label="Changer le statut">
      {statusOptions[type].map((status) => <option key={status} value={status}>{labels[status]}</option>)}
    </select>
  );
}

export default function AdminDashboard({ initialData, userName, signOutPath }: { initialData: AdminData; userName: string; signOutPath: string }) {
  const [data, setData] = useState(initialData);
  const [tab, setTab] = useState<"requests" | "artisans" | "feedback" | "maintenance">("requests");
  const [query, setQuery] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [notice, setNotice] = useState("");
  const [cleanupPhrase, setCleanupPhrase] = useState("");

  const stats = useMemo(() => ({
    newRequests: data.requests.filter((item) => item.status === "new").length,
    pendingArtisans: data.artisans.filter((item) => item.status === "pending").length,
    completed: data.requests.filter((item) => item.status === "completed").length,
    complaints: data.feedback.filter((item) => item.kind === "complaint" && item.status !== "resolved").length,
    collectedRevenue: data.requests.filter((item) => item.commissionStatus === "collected").reduce((sum, item) => sum + item.commissionAmount, 0),
    dueRevenue: data.requests.filter((item) => item.commissionStatus === "due").reduce((sum, item) => sum + item.commissionAmount, 0),
    averageRating: (() => { const ratings = data.feedback.filter((item) => item.kind === "review" && item.rating).map((item) => item.rating as number); return ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0; })(),
  }), [data]);

  const recruitment = useMemo(() => [
    { label: "Réparateurs", trade: "Réparateur de téléphone", count: data.artisans.filter((item) => item.status === "accepted" && item.trade === "Réparateur de téléphone").length },
    { label: "Électriciens", trade: "Électricien", count: data.artisans.filter((item) => item.status === "accepted" && item.trade === "Électricien").length },
    { label: "Plombiers", trade: "Plombier", count: data.artisans.filter((item) => item.status === "accepted" && item.trade === "Plombier").length },
  ], [data.artisans]);

  const normalized = query.trim().toLowerCase();
  const filteredRequests = data.requests.filter((item) => Object.values(item).join(" ").toLowerCase().includes(normalized));
  const filteredArtisans = data.artisans.filter((item) => item.status !== "account_only" && Object.values(item).join(" ").toLowerCase().includes(normalized));
  const filteredFeedback = data.feedback.filter((item) => Object.values(item).join(" ").toLowerCase().includes(normalized));

  async function updateStatus(type: keyof typeof statusOptions, id: number, status: string) {
    const key = `${type}-${id}`;
    setBusyKey(key);
    setNotice("");
    try {
      const response = await fetch("/api/admin/status", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, id, status }) });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "La mise à jour a échoué.");
      const collection = type === "request" ? "requests" : type === "artisan" ? "artisans" : "feedback";
      setData((current) => ({ ...current, [collection]: current[collection].map((item) => item.id === id ? { ...item, status } : item) }));
      setNotice("Statut mis à jour.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "La mise à jour a échoué. Réessayez.");
    } finally {
      setBusyKey("");
    }
  }

  function updateRequestLocal(id: number, patch: Partial<ServiceRequest>) {
    setData((current) => ({ ...current, requests: current.requests.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  }

  async function saveRequestDetails(item: ServiceRequest) {
    const key = `details-${item.id}`;
    setBusyKey(key);
    setNotice("");
    try {
      const response = await fetch("/api/admin/request-details", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, assignedArtisan: item.assignedArtisan, commissionAmount: item.commissionAmount, commissionStatus: item.commissionStatus }) });
      if (!response.ok) throw new Error();
      setNotice("Affectation et commission enregistrées.");
    } catch {
      setNotice("L’enregistrement a échoué. Réessayez.");
    } finally {
      setBusyKey("");
    }
  }

  async function cleanupTestData() {
    if (cleanupPhrase !== "NETTOYER") return;
    if (!window.confirm("Dernière confirmation : supprimer toutes les demandes, tous les experts, comptes, publications, avis et fichiers de test ? Cette action est irréversible.")) return;
    setBusyKey("cleanup");
    setNotice("");
    try {
      const response = await fetch("/api/admin/test-data", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: cleanupPhrase }) });
      const result = await response.json().catch(() => ({})) as { error?: string; deleted?: { requests: number; experts: number; posts: number; feedback: number; accounts: number; files: number } };
      if (!response.ok || !result.deleted) throw new Error(result.error || "Le nettoyage a échoué.");
      setData({ requests: [], artisans: [], feedback: [] });
      setCleanupPhrase("");
      setNotice(`Nettoyage terminé : ${result.deleted.requests} demande(s), ${result.deleted.experts} expert(s), ${result.deleted.posts} publication(s), ${result.deleted.feedback} avis/plainte(s) et ${result.deleted.files} fichier(s) supprimés.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Le nettoyage a échoué. Aucune nouvelle tentative n’a été lancée.");
    } finally {
      setBusyKey("");
    }
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/"><span>AT</span><div><strong>Allô Tchad</strong><small>Administration</small></div></Link>
        <nav className="admin-nav" aria-label="Sections administratives">
          <button className={tab === "requests" ? "active" : ""} onClick={() => setTab("requests")}><span>⌁</span> Demandes <b>{data.requests.length}</b></button>
          <button className={tab === "artisans" ? "active" : ""} onClick={() => setTab("artisans")}><span>♙</span> Experts <b>{data.artisans.length}</b></button>
          <button className={tab === "feedback" ? "active" : ""} onClick={() => setTab("feedback")}><span>◇</span> Avis & plaintes <b>{data.feedback.length}</b></button>
          <button className={tab === "maintenance" ? "active" : ""} onClick={() => setTab("maintenance")}><span>⚙</span> Maintenance <b>!</b></button>
        </nav>
        <div className="admin-sidebar-foot"><Link href="/">Voir le site public ↗</Link><a href={signOutPath}>Se déconnecter</a></div>
      </aside>

      <section className="admin-content">
        <header className="admin-topbar">
          <div><span>Centre de contrôle</span><h1>Bonjour, {userName}</h1></div>
          <div className="admin-user"><i>{userName.slice(0, 1).toUpperCase()}</i><span>Administrateur<small>Session protégée</small></span></div>
        </header>

        <section className="admin-stats" aria-label="Indicateurs principaux">
          <article><span className="stat-icon blue">⌁</span><div><small>Nouvelles demandes</small><strong>{stats.newRequests}</strong></div><em>À traiter</em></article>
          <article><span className="stat-icon yellow">♙</span><div><small>Experts à vérifier</small><strong>{stats.pendingArtisans}</strong></div><em>Dossiers</em></article>
          <article><span className="stat-icon green">✓</span><div><small>Interventions terminées</small><strong>{stats.completed}</strong></div><em>Total</em></article>
          <article><span className="stat-icon red">!</span><div><small>Réclamations ouvertes</small><strong>{stats.complaints}</strong></div><em>Priorité</em></article>
        </section>

        <section className="pilot-grid" aria-label="Pilotage du lancement">
          <article className="recruitment-panel"><div className="pilot-head"><span>Objectif initial</span><strong>{recruitment.reduce((sum, item) => sum + Math.min(item.count, 2), 0)} / 6 experts vérifiés</strong></div><div className="recruitment-bars">{recruitment.map((item) => <div key={item.trade}><label><span>{item.label}</span><b>{item.count} / 2</b></label><i><em style={{ width: `${Math.min(item.count / 2, 1) * 100}%` }} /></i></div>)}</div></article>
          <article className="revenue-panel"><div><span>Commission après essai</span><strong>1 000 à 3 000 FCFA</strong><small>Par intervention réussie</small></div><dl><div><dt>À encaisser</dt><dd>{stats.dueRevenue.toLocaleString("fr-FR")} FCFA</dd></div><div><dt>Encaissé</dt><dd>{stats.collectedRevenue.toLocaleString("fr-FR")} FCFA</dd></div><div><dt>Note moyenne</dt><dd>{stats.averageRating ? `${stats.averageRating.toFixed(1)} / 5` : "—"}</dd></div></dl></article>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <div><span>{tab === "maintenance" ? "Outils administrateur" : "Suivi opérationnel"}</span><h2>{tab === "requests" ? "Demandes des clients" : tab === "artisans" ? "Candidatures experts" : tab === "feedback" ? "Avis et réclamations" : "Nettoyer les données de test"}</h2></div>
            {tab !== "maintenance" && <label className="admin-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher…" /></label>}
          </div>
          {notice && <p className="admin-notice" role="status">{notice}</p>}

          {tab === "requests" && <div className="admin-table-wrap"><table className="request-table"><thead><tr><th>Référence</th><th>Client</th><th>Service</th><th>Lieu</th><th>Demande</th><th>Expert affecté</th><th>Commission</th><th>Date</th><th>Statut</th></tr></thead><tbody>
            {filteredRequests.map((item) => <tr key={item.id}><td><strong>{item.reference}</strong><small className={`urgency urgency-${item.urgency.toLowerCase().replace("’", "")}`}>{item.urgency}</small></td><td>{item.customerName}<a href={`tel:${item.customerPhone}`}>{item.customerPhone}</a></td><td>{item.service}</td><td>{item.city}<small>{item.district}</small></td><td className="detail-cell">{item.details}</td><td><select className="table-input" value={item.assignedArtisan ?? ""} onChange={(event) => updateRequestLocal(item.id, { assignedArtisan: event.target.value || null })}><option value="">Aucun expert</option>{data.artisans.filter((expert) => expert.status === "accepted").map((expert) => <option value={expert.name} key={expert.id}>{expert.name} · {expert.trade}</option>)}</select></td><td><div className="commission-controls"><select value={item.commissionAmount} onChange={(event) => updateRequestLocal(item.id, { commissionAmount: Number(event.target.value) })}><option value={0}>Essai · 0</option><option value={1000}>1 000 FCFA</option><option value={2000}>2 000 FCFA</option><option value={3000}>3 000 FCFA</option></select><select value={item.commissionStatus} onChange={(event) => updateRequestLocal(item.id, { commissionStatus: event.target.value })}><option value="not_applicable">Non applicable</option><option value="due">À encaisser</option><option value="collected">Encaissée</option><option value="waived">Annulée</option></select><button type="button" disabled={busyKey === `details-${item.id}`} onClick={() => saveRequestDetails(item)}>Enregistrer</button></div></td><td>{dateLabel(item.createdAt)}</td><td><StatusSelect type="request" id={item.id} value={item.status} onChange={updateStatus} busy={busyKey === `request-${item.id}`} /></td></tr>)}
            {!filteredRequests.length && <tr><td colSpan={9} className="empty-row">Aucune demande trouvée.</td></tr>}
          </tbody></table></div>}

          {tab === "artisans" && <div className="candidate-list">
            {filteredArtisans.map((item) => <article className="candidate-card" key={item.id}>
              <header><div><span>{item.reference}</span><h3>{item.name}</h3><p>{item.trade} · {item.experience} an{item.experience > 1 ? "s" : ""} d’expérience</p></div><StatusSelect type="artisan" id={item.id} value={item.status} onChange={updateStatus} busy={busyKey === `artisan-${item.id}`} /></header>
              <div className="candidate-facts">
                <dl><div><dt>WhatsApp</dt><dd><a href={`tel:${item.phone}`}>{item.phone}</a></dd></div><div><dt>Ville et quartier</dt><dd>{item.area}</dd></div><div><dt>Zone d’intervention</dt><dd>{item.coverage}</dd></div><div><dt>Disponibilité</dt><dd>{item.availability}</dd></div><div><dt>Atelier</dt><dd>{item.workshopAddress || "Non renseigné"}</dd></div></dl>
                <dl><div><dt>Type de pièce</dt><dd>{item.identityType || "Non renseigné"}</dd></div><div><dt>Numéro national d’identification (NNI)</dt><dd>{item.identityNumber || "Non renseigné"}</dd></div><div><dt>Contrôle du NNI</dt><dd>{/^\d{10}$/.test(item.identityNumber || "") ? "Valide · 10 chiffres" : "À corriger"}</dd></div></dl>
              </div>
              <section className="candidate-access"><div><span>Connexion à l’espace professionnel</span><small>L’expert se connecte avec ce numéro de suivi. Son accès devient automatiquement actif quand vous acceptez sa candidature.</small></div><strong>{item.reference}</strong></section>
              {item.documents.length > 0 && <section className="candidate-documents"><header><div><span>Justificatifs d’un ancien dossier</span><strong>{item.documents.length} fichier{item.documents.length > 1 ? "s" : ""}</strong></div><small>Visibles uniquement par les administrateurs</small></header><div>{item.documents.map((document) => <a key={document.id} href={`/api/admin/artisan-documents/${document.id}`} target="_blank" rel="noreferrer"><span>{document.contentType === "application/pdf" ? "PDF" : "IMG"}</span><div><strong>{documentLabels[document.kind] || document.originalName}</strong><small>{fileSizeLabel(document.size)} · Ouvrir</small></div><b>↗</b></a>)}</div></section>}
            </article>)}
            {!filteredArtisans.length && <p className="empty-row">Aucune candidature trouvée.</p>}
          </div>}

          {tab === "feedback" && <div className="admin-table-wrap"><table><thead><tr><th>Référence</th><th>Type</th><th>Client</th><th>Demande liée</th><th>Message</th><th>Date</th><th>Statut</th></tr></thead><tbody>
            {filteredFeedback.map((item) => <tr key={item.id}><td><strong>{item.reference}</strong></td><td><span className={`kind kind-${item.kind}`}>{item.kind === "complaint" ? "Réclamation" : "Avis"}</span>{item.rating && <small className="stars">{"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}</small>}</td><td>{item.customerName}<a href={`tel:${item.customerPhone}`}>{item.customerPhone}</a></td><td>{item.requestReference || "—"}</td><td className="detail-cell">{item.details}</td><td>{dateLabel(item.createdAt)}</td><td><StatusSelect type="feedback" id={item.id} value={item.status} onChange={updateStatus} busy={busyKey === `feedback-${item.id}`} /></td></tr>)}
            {!filteredFeedback.length && <tr><td colSpan={7} className="empty-row">Aucun avis ou réclamation.</td></tr>}
          </tbody></table></div>}

          {tab === "maintenance" && <section className="admin-cleanup-zone">
            <div className="cleanup-warning-icon" aria-hidden="true">!</div>
            <div className="cleanup-copy"><span>Zone sensible</span><h3>Supprimer toutes les données utilisées pendant les essais</h3><p>Cette opération efface définitivement les demandes, comptes et candidatures experts, publications, messages, avis, notifications et fichiers envoyés. L’accès administrateur et la configuration du site sont conservés.</p></div>
            <dl><div><dt>Demandes</dt><dd>{data.requests.length}</dd></div><div><dt>Experts</dt><dd>{data.artisans.length}</dd></div><div><dt>Avis et plaintes</dt><dd>{data.feedback.length}</dd></div></dl>
            <label>Écrivez <strong>NETTOYER</strong> pour activer le bouton<input value={cleanupPhrase} onChange={(event) => setCleanupPhrase(event.target.value.toUpperCase())} placeholder="NETTOYER" autoComplete="off" /></label>
            <button type="button" className="cleanup-button" disabled={cleanupPhrase !== "NETTOYER" || busyKey === "cleanup"} onClick={cleanupTestData}>{busyKey === "cleanup" ? "Nettoyage en cours…" : "Nettoyer les données de test"}</button>
            <small>Une dernière confirmation sera demandée avant la suppression.</small>
          </section>}
        </section>
      </section>
    </main>
  );
}
