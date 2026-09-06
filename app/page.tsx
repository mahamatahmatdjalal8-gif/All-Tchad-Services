"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { allTrades, serviceCategories } from "./service-catalog";
import SocialFeed from "./reseau/social-feed";
import "./reseau/reseau.css";

type ModalName = "request" | "artisan" | "feedback" | null;

const whatsappContacts = [
  { number: "23563304046", label: "WhatsApp officiel" },
];

type AppSettings = {
  homeEyebrow: string;
  homeTitle: string;
  homeDescription: string;
  announcement: string;
  whatsapp: string;
  phone: string;
  requestsEnabled: boolean;
  postsEnabled: boolean;
  maintenanceMode: boolean;
};

const defaultAppSettings: AppSettings = {
  homeEyebrow: "Le bon expert, au bon moment",
  homeTitle: "Que recherchez-vous aujourd’hui ?",
  homeDescription:
    "Découvrez les experts, leurs réalisations et leur disponibilité. Demandez un prix avant le travail.",
  announcement: "",
  whatsapp: "23563304046",
  phone: "",
  requestsEnabled: true,
  postsEnabled: true,
  maintenanceMode: false,
};

function buildMessage(form: HTMLFormElement, kind: "client" | "artisan") {
  const data = new FormData(form);
  const lines = kind === "client"
    ? ["Bonjour Allô Tchad Services,", "", `Service : ${data.get("service")}`, `Ville : ${data.get("city")}`, `Quartier : ${data.get("district")}`, `Urgence : ${data.get("urgency")}`, `Besoin : ${data.get("details")}`]
    : ["Bonjour Allô Tchad Services, je soumets ma candidature expert.", "", `Nom : ${data.get("name")}`, `WhatsApp : ${data.get("phone")}`, `Métier : ${data.get("trade")}`, `Zone : ${data.get("area")}`, `Expérience : ${data.get("experience")} an(s)`, `Disponibilité : ${data.get("availability")}`];
  return lines.join("\n");
}

function buildFeedbackMessage(form: HTMLFormElement) {
  const data = new FormData(form);
  const kind = data.get("kind") === "complaint" ? "Réclamation" : "Avis client";
  return ["Bonjour Allô Tchad Services,", "", `Type : ${kind}`, `Nom : ${data.get("customerName")}`, `Téléphone : ${data.get("customerPhone")}`, data.get("rating") ? `Note : ${data.get("rating")}/5` : null, `Message : ${data.get("details")}`].filter(Boolean).join("\n");
}

async function readApiResult(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as { reference?: string; error?: string; requiresAccount?: boolean; status?: string };
  } catch {
    return { error: response.ok ? "Réponse inattendue du service." : "L’envoi a échoué. Vérifiez votre connexion puis réessayez." };
  }
}

function WhatsAppActions({ message }: { message?: string }) {
  if (!message) return null;
  return <div className="whatsapp-actions">
    {whatsappContacts.map((contact) => <a key={contact.number} href={`https://wa.me/${contact.number}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" aria-label={`Envoyer le message à ${contact.label}`}>Envoyer au WhatsApp officiel</a>)}
  </div>;
}

function TrackingReceipt({ reference, copied, onCopy }: { reference: string; copied: boolean; onCopy: () => void }) {
  return <section className="tracking-receipt" aria-live="polite">
    <div className="tracking-receipt-check" aria-hidden="true">✓</div>
    <span>Candidature bien reçue</span>
    <h3>Votre candidature est en vérification</h3>
    <p>Vous pouvez continuer à utiliser votre compte, demander des services et discuter. La publication et le profil public seront activés après acceptation.</p>
    <div className="tracking-reference-box"><strong>{reference}</strong><button type="button" onClick={onCopy}>{copied ? "Copié ✓" : "Copier"}</button></div>
    <small>Gardez votre mot de passe expert privé.</small>
    <a className="tracking-receipt-link" href="/espace-expert?tab=profile">Retourner à mon compte <b>→</b></a>
  </section>;
}

function RequestReceipt({ message }: { message?: string }) {
  return <section className="tracking-receipt request-receipt" aria-live="polite"><div className="tracking-receipt-check" aria-hidden="true">✓</div><span>Demande envoyée</span><h3>Nous vous contacterons directement</h3><p>Votre demande est enregistrée. L’équipe ou l’expert vous répondra avec le numéro de téléphone indiqué.</p><a className="tracking-receipt-link" href="/experts">Découvrir les experts <b>→</b></a><WhatsAppActions message={message} /></section>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
      <header><div><span>Allô Tchad Services</span><h2>{title}</h2></div><button type="button" onClick={onClose} aria-label="Fermer">×</button></header>
      <div className="modal-body">{children}</div>
    </section>
  </div>;
}

export default function Home() {
  const [modal, setModal] = useState<ModalName>(null);
  const [feedbackKind, setFeedbackKind] = useState("review");
  const [submitting, setSubmitting] = useState<"request" | "artisan" | "feedback" | "">("");
  const [formError, setFormError] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<{ type: string; reference?: string; message?: string } | null>(null);
  const [copiedReference, setCopiedReference] = useState("");
  const [preferredService, setPreferredService] = useState("");
  const [preferredExpert, setPreferredExpert] = useState("");
  const [preferredTrade, setPreferredTrade] = useState("");
  const [homeCategory, setHomeCategory] = useState(serviceCategories[0].id);
  const [artisanStep, setArtisanStep] = useState(1);
  const [artisanSummary, setArtisanSummary] = useState({ name: "", trade: "", area: "" });
  const [personalAccount, setPersonalAccount] = useState<{ name: string; phone: string } | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultAppSettings);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const artisanFormRef = useRef<HTMLFormElement>(null);
  const activeHomeCategory = serviceCategories.find((category) => category.id === homeCategory) ?? serviceCategories[0];

  async function copyReference(reference: string) {
    try {
      await navigator.clipboard.writeText(reference);
      setCopiedReference(reference);
      window.setTimeout(() => setCopiedReference((current) => current === reference ? "" : current), 2200);
    } catch {
      setCopiedReference("");
    }
  }

  function rememberReference(reference: string) {
    try { window.localStorage.setItem("ats_last_artisan_reference", reference); } catch { /* Stockage indisponible : le numéro reste affiché. */ }
  }

  useEffect(() => {
    fetch("/api/account")
      .then(async (response) => response.ok ? response.json() : null)
      .then((result) => {
        if (result?.account) setPersonalAccount(result.account);
      })
      .catch(() => undefined);

    fetch("/api/app-settings")
      .then(async (response) => {
        if (!response.ok) return null;

        return await response.json() as {
          settings?: AppSettings;
        };
      })
      .then((result) => {
        if (result?.settings) {
          setAppSettings(result.settings);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        setSettingsLoaded(true);
      });

    const frame = window.requestAnimationFrame(() => {
      const hash = window.location.hash;
      const params = new URLSearchParams(window.location.search);
      const requestedService = params.get("service") ?? "";
      const requestedExpert = params.get("expert") ?? "";
      const requestedTrade = params.get("trade") ?? "";
      if (allTrades.includes(requestedService)) setPreferredService(requestedService);
      if (requestedExpert) setPreferredExpert(requestedExpert.slice(0, 100));
      if (allTrades.includes(requestedTrade)) setPreferredTrade(requestedTrade);
      if (hash === "#demande") setModal("request");
      if (hash === "#artisan") setModal("artisan");
      if (hash === "#avis") setModal("feedback");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function openModal(name: ModalName) {
    if (name === "artisan" && !personalAccount) { window.location.assign("/profil"); return; }
    setSuccess(null);
    setFormError({});
    if (name === "artisan") setArtisanStep(1);
    setModal(name);
  }

  function moveArtisanStep(nextStep: number) {
    setArtisanStep(nextStep);
    window.requestAnimationFrame(() => document.querySelector(".modal-body")?.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function continueArtisan() {
    const form = artisanFormRef.current;
    const step = form?.querySelector(`[data-artisan-step="${artisanStep}"]`);
    const controls = Array.from(step?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea") ?? []);
    for (const control of controls) {
      if (!control.checkValidity()) {
        control.reportValidity();
        return;
      }
    }
    if (artisanStep === 3 && form) {
      const data = new FormData(form);
      setArtisanSummary({
        name: String(data.get("name") ?? ""),
        trade: String(data.get("trade") ?? ""),
        area: String(data.get("area") ?? ""),
      });
    }
    moveArtisanStep(Math.min(artisanStep + 1, 4));
  }

  function openRequest(service = "") {
    if (
      !appSettings.requestsEnabled ||
      appSettings.maintenanceMode
    ) {
      window.alert(
        "Les nouvelles demandes sont temporairement indisponibles."
      );
      return;
    }

    setPreferredService(service);
    setPreferredExpert("");
    openModal("request");
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSubmitting("request"); setFormError({});
    try {
      const response = await fetch("/api/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      const result = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || !result.success) throw new Error(result.error || "Enregistrement impossible.");
      setSuccess({ type: "request", message: buildMessage(form, "client") });
      form.reset();
    } catch (error) { setFormError({ request: error instanceof Error ? error.message : "Enregistrement impossible." }); }
    finally { setSubmitting(""); }
  }

  async function submitArtisan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSubmitting("artisan"); setFormError({});
    try {
      const body = new FormData(form);
      const response = await fetch("/api/artisans", { method: "POST", body });
      const result = await readApiResult(response);
      if (response.status === 401 && result.requiresAccount) { window.location.assign("/profil"); return; }
      if (!response.ok || !result.reference) throw new Error(result.error || "Enregistrement impossible.");
      rememberReference(result.reference);
      window.location.assign("/espace-expert?tab=profile");
    } catch (error) { setFormError({ artisan: error instanceof Error ? error.message : "Enregistrement impossible." }); }
    finally { setSubmitting(""); }
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSubmitting("feedback"); setFormError({});
    try {
      const response = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      const result = await response.json() as { reference?: string; error?: string };
      if (!response.ok || !result.reference) throw new Error(result.error || "Enregistrement impossible.");
      setSuccess({ type: "feedback", reference: result.reference, message: `${buildFeedbackMessage(form)}\n\nRéférence : ${result.reference}` });
      form.reset(); setFeedbackKind("review");
    } catch (error) { setFormError({ feedback: error instanceof Error ? error.message : "Enregistrement impossible." }); }
    finally { setSubmitting(""); }
  }

  if (!settingsLoaded) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#ffffff",
        }}
      >
        <strong>Allô Tchad Services</strong>
      </main>
    );
  }

  if (appSettings.maintenanceMode) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#f4f7fb",
        }}
      >
        <section
          style={{
            width: "min(560px, 100%)",
            padding: 32,
            borderRadius: 22,
            background: "#ffffff",
            textAlign: "center",
            boxShadow:
              "0 15px 50px rgba(15,23,42,.08)",
          }}
        >
          <div
            className="brand-mark"
            style={{ margin: "0 auto 20px" }}
          >
            AT
          </div>

          <span>Allô Tchad Services</span>
          <h1>Maintenance en cours</h1>

          <p>
            Nous améliorons actuellement la plateforme.
            Merci de revenir dans quelques instants.
          </p>
        </section>
      </main>
    );
  }

  return <main>
    <header className="site-header">
      <a className="brand" href="#accueil" aria-label="Allô Tchad Services, accueil"><span className="brand-mark">AT</span><span><strong>Allô Tchad</strong><small>Services</small></span></a>
      <nav className="desktop-app-nav" aria-label="Navigation principale">
        <a className="active" href="#accueil"><i aria-hidden="true">⌂</i><span>Accueil</span></a>
        <a href="/experts"><i aria-hidden="true">⌕</i><span>Experts</span></a>
        <button type="button" onClick={() => openRequest()}><i aria-hidden="true">＋</i><span>Demande</span></button>
        <a href="/reseau"><i aria-hidden="true">▤</i><span>Réalisations</span></a>
        <a href="/profil"><i aria-hidden="true">♙</i><span>Profil</span></a>
      </nav>
      <a className="nav-cta" href="/profil">Mon espace</a>
    </header>

    <section className="social-home professional-home" id="accueil" aria-label="Accueil vivant Allô Tchad Services">

      {appSettings.announcement && (
        <div
          role="status"
          style={{
            marginBottom: 14,
            padding: "13px 16px",
            borderRadius: 14,
            background: "#eef6ff",
            border: "1px solid #bfdbfe",
            fontWeight: 700,
          }}
        >
          {appSettings.announcement}
        </div>
      )}

      <section className="home-live-toolbar">
        <div className="home-live-copy"><span>{appSettings.homeEyebrow}</span><h1>{appSettings.homeTitle}</h1><p>{appSettings.homeDescription}</p></div>
        <div className="home-live-actions"><a href="/experts"><i aria-hidden="true">⌕</i><span><small>Par métier ou quartier</small><strong>Rechercher un expert</strong></span><b>→</b></a><button type="button" onClick={() => openRequest()}><i aria-hidden="true">＋</i><span><small>Expliquez votre besoin</small><strong>{appSettings.requestsEnabled ? "Demander un service" : "Demandes suspendues"}</strong></span><b>→</b></button></div>
        <div className="home-trust-line"><span>✓ Experts vérifiés</span><span>✓ Prix annoncé avant</span><span>✓ Avis après intervention</span></div>
      </section>

      <section className="home-service-stories" aria-label="Catégories de services">
        <header><div><span>Explorer</span><h2>Services populaires</h2></div><a href="/experts">Voir tous les métiers →</a></header>
        <div className="home-story-strip">{serviceCategories.map((category) => <button type="button" key={category.id} className={homeCategory === category.id ? "active" : ""} onClick={() => setHomeCategory(category.id)} aria-pressed={homeCategory === category.id}><b>{category.icon}</b><span>{category.name}</span></button>)}</div>
        <div className="home-story-trades" aria-live="polite"><header><b>{activeHomeCategory.icon}</b><span><strong>{activeHomeCategory.name}</strong><small>{activeHomeCategory.description}</small></span></header><div>{activeHomeCategory.trades.map((trade) => <button type="button" key={trade} onClick={() => openRequest(trade)}>{trade}<span>＋</span></button>)}</div></div>
      </section>

      {appSettings.postsEnabled && (
        <>
          <header className="home-activity-title"><div><span>Fil public</span><h2>Réalisations près de chez vous</h2><p>Les publications des experts vérifiés, mises à jour automatiquement.</p></div><a href="/reseau">Voir toutes les réalisations →</a></header>
          <SocialFeed mode="home" />
        </>
      )}
    </section>

    <nav className="mobile-bottom-nav" aria-label="Navigation mobile">
      <a className="active" href="#accueil"><i aria-hidden="true">⌂</i><span>Accueil</span></a>
      <a href="/reseau"><i aria-hidden="true">▤</i><span>Réalisations</span></a>
      <button className="bottom-create" type="button" onClick={() => openRequest()}><i aria-hidden="true">＋</i><span>Demande</span></button>
      <a href="/experts"><i aria-hidden="true">👥</i><span>Experts</span></a>
      <a href="/profil"><i aria-hidden="true">♙</i><span>Profil</span></a>
    </nav>

    <footer className="site-footer compact-footer" id="confiance">
      <div className="footer-main">
        <div className="footer-identity"><a className="brand" href="#accueil"><span className="brand-mark">AT</span><span><strong>Allô Tchad</strong><small>Services</small></span></a><p>Des experts fiables, près de chez vous.</p></div>
      </div>
      <details className="footer-more">
        <summary><span>Informations et confiance</span><i aria-hidden="true">＋</i></summary>
        <nav aria-label="Informations et confiance"><a href="/conditions-utilisation">Conditions</a><a href="/confidentialite">Confidentialité</a><a href="/regles-experts">Règles des experts</a><a href="/procedure-plainte">Procédure de plainte</a><a href="/contact">Contact & horaires</a></nav>
      </details>
      <div className="footer-bottom"><small>Coordonnées privées · Experts vérifiés · Prix annoncé avant intervention</small><a href="/admin">Administration</a></div>
    </footer>

    {modal === "request" && <Modal title="Demander un service" onClose={() => setModal(null)}>
      <form onSubmit={submitRequest}>
        <div className="two-columns"><label>Nom complet<input name="customerName" autoComplete="name" minLength={3} required /></label><label>Téléphone<input name="customerPhone" type="tel" inputMode="tel" autoComplete="tel" pattern="[+0-9 ]{8,18}" placeholder="+235…" required /></label></div>
        {preferredExpert && <div className="preferred-expert-note"><span>✓</span><div><small>Expert souhaité</small><strong>{preferredExpert}</strong></div><input type="hidden" name="preferredExpert" value={preferredExpert} /></div>}
        <label>Service<select key={preferredService || "service-empty"} name="service" required defaultValue={preferredService}><option value="" disabled>Choisissez un métier</option>{serviceCategories.map((category) => <optgroup label={`${category.icon} ${category.name}`} key={category.id}>{category.trades.map((trade) => <option key={trade}>{trade}</option>)}</optgroup>)}<option>Autre besoin</option></select></label>
        <div className="two-columns"><label>Ville<select name="city" defaultValue="N’Djamena" required><option>N’Djamena</option><option>Moundou</option><option>Sarh</option><option>Abéché</option><option>Autre ville</option></select></label><label>Quartier<input name="district" placeholder="Ex. Moursal" required /></label></div>
        <label>Problème<textarea name="details" rows={3} maxLength={800} placeholder="Décrivez brièvement le problème…" required /></label>
        <fieldset><legend>Urgence</legend><div className="urgency-options"><label><input type="radio" name="urgency" value="Normal" defaultChecked /><span>Normal</span></label><label><input type="radio" name="urgency" value="Aujourd’hui" /><span>Aujourd’hui</span></label><label><input type="radio" name="urgency" value="Urgent" /><span>Urgent</span></label></div></fieldset>
        <input className="website-field" name="website" tabIndex={-1} autoComplete="off" />
        <button className="form-submit" type="submit" disabled={submitting === "request"}>{submitting === "request" ? "Enregistrement…" : "Enregistrer ma demande"}<span>→</span></button>
        {success?.type === "request" && <RequestReceipt message={success.message} />}{formError.request && <p className="form-error">{formError.request}</p>}
        <small className="privacy-note">Vos coordonnées restent privées et servent uniquement à vous contacter au sujet de cette demande.</small>
      </form>
    </Modal>}

    {modal === "artisan" && <Modal title="Déposer ma candidature" onClose={() => setModal(null)}>
      <form ref={artisanFormRef} className="artisan-wizard" onSubmit={submitArtisan}>
        <div className="wizard-progress" aria-label={`Étape ${artisanStep} sur 4`}><div><span>Étape {artisanStep} sur 4</span><strong>{["Profil", "Activité", "Identité", "Confirmation"][artisanStep - 1]}</strong></div><i><em style={{ width: `${artisanStep * 25}%` }} /></i><ol>{["Profil", "Activité", "Identité", "Valider"].map((label, index) => <li className={artisanStep >= index + 1 ? "active" : ""} key={label}><b>{artisanStep > index + 1 ? "✓" : index + 1}</b><span>{label}</span></li>)}</ol></div>

        <section className="wizard-step" data-artisan-step="1" hidden={artisanStep !== 1}>
          <div className="wizard-heading"><span>👋</span><div><h3>Faisons connaissance</h3><p>Quelques informations pour créer votre profil professionnel.</p></div></div>
          {personalAccount ? <div className="account-linked-form-note"><strong>{personalAccount.name}</strong><span>{personalAccount.phone} · identité liée au compte personnel</span><input type="hidden" name="name" value={personalAccount.name} /><input type="hidden" name="phone" value={personalAccount.phone} /></div> : <div className="two-columns"><label>Nom figurant sur votre pièce<input name="name" autoComplete="name" minLength={4} placeholder="Votre nom complet" required /></label><label>Numéro WhatsApp<input name="phone" type="tel" inputMode="tel" pattern="[+0-9 ]{8,18}" placeholder="+235…" required /></label></div>}
          <div className="two-columns"><label>Votre métier<select name="trade" required defaultValue={preferredTrade}><option value="" disabled>Choisissez votre métier</option>{serviceCategories.map((category) => <optgroup label={`${category.icon} ${category.name}`} key={category.id}>{category.trades.map((trade) => <option key={trade}>{trade}</option>)}</optgroup>)}<option>Autre métier technique</option></select></label><label>Années d’expérience<input name="experience" type="number" min={1} max={50} placeholder="Ex. 4" required /></label></div>
          <p className="wizard-reassurance">🔒 Vos coordonnées ne seront pas affichées publiquement.</p>
        </section>

        <section className="wizard-step" data-artisan-step="2" hidden={artisanStep !== 2}>
          <div className="wizard-heading"><span>🛠️</span><div><h3>Parlez-nous de votre activité</h3><p>Où intervenez-vous et quand êtes-vous disponible ?</p></div></div>
          <label>Ville et quartier<input name="area" minLength={5} placeholder="Ex. N’Djamena, Chagoua" required /></label>
          <label>Zones d’intervention<input name="coverage" minLength={5} placeholder="Les quartiers où vous pouvez vous déplacer" required /></label>
          <label>Adresse de l’atelier<input name="workshopAddress" minLength={5} maxLength={180} placeholder="Adresse précise ou écrivez : Sans atelier" required /></label>
          <label>Disponibilité<select name="availability" required defaultValue=""><option value="" disabled>Choisissez</option><option>Journées en semaine</option><option>Soirs en semaine</option><option>Week-ends</option><option>Tous les jours</option></select></label>
        </section>

        <section className="wizard-step" data-artisan-step="3" hidden={artisanStep !== 3}>
          <div className="wizard-heading"><span>🪪</span><div><h3>Vérifiez votre identité</h3><p>Indiquez les informations figurant sur votre pièce.</p></div></div>
          <section className="verification-section"><header><span>ID</span><div><strong>Identité</strong><small>Ces informations restent privées et sont visibles uniquement par l’administration.</small></div></header><div className="two-columns"><label>Type de pièce<select name="identityType" required defaultValue=""><option value="" disabled>Choisissez</option><option>Carte nationale d’identité</option><option>Passeport</option><option>Permis de conduire</option></select></label><label>Numéro national d’identification (NNI)<input name="identityNumber" minLength={10} maxLength={10} pattern="[0-9]{10}" inputMode="numeric" placeholder="10 chiffres exactement" title="Le NNI doit contenir exactement 10 chiffres." required /><small>Obligatoire · exactement 10 chiffres</small></label></div></section>
          <p className="wizard-reassurance">🔒 Votre NNI ne sera jamais affiché dans l’annuaire public.</p>
        </section>

        <section className="wizard-step" data-artisan-step="4" hidden={artisanStep !== 4}>
          {success?.type === "artisan" ? <TrackingReceipt reference={success.reference || ""} copied={copiedReference === success.reference} onCopy={() => copyReference(success.reference || "")} /> : <>
            <div className="wizard-heading"><span>✅</span><div><h3>Tout est prêt</h3><p>Relisez ce résumé puis confirmez votre candidature.</p></div></div>
            <div className="candidate-summary"><span>Votre dossier</span><dl><div><dt>Nom</dt><dd>{artisanSummary.name}</dd></div><div><dt>Métier</dt><dd>{artisanSummary.trade}</dd></div><div><dt>Zone</dt><dd>{artisanSummary.area}</dd></div></dl></div>
            <div className="consent-stack"><label className="consent-row"><input type="checkbox" name="identityConsent" required /><span>Je certifie l’exactitude de mes informations et j’accepte la vérification de mon identité.</span></label><label className="consent-row"><input type="checkbox" name="conductConsent" required /><span>J’accepte le code de conduite : ponctualité, respect, sécurité et aucun frais caché.</span></label><label className="consent-row"><input type="checkbox" name="publicListing" required /><span>Si mon dossier est accepté, j’accepte l’affichage public de mon profil professionnel. Mon numéro restera privé.</span></label></div>
            <input className="website-field" name="website" tabIndex={-1} autoComplete="off" />
          </>}
        </section>

        {success?.type !== "artisan" && <div className="wizard-actions">{artisanStep > 1 && <button className="wizard-back" type="button" onClick={() => moveArtisanStep(artisanStep - 1)}>← Retour</button>}<span />{artisanStep < 4 ? <button className="wizard-next" type="button" onClick={continueArtisan}>Continuer <b>→</b></button> : <button className="wizard-submit" type="submit" disabled={submitting === "artisan"}>{submitting === "artisan" ? "Envoi sécurisé…" : "Envoyer ma candidature"}<b>→</b></button>}</div>}
        {formError.artisan && <p className="form-error">{formError.artisan}</p>}
      </form>
    </Modal>}

    {modal === "feedback" && <Modal title="Avis ou réclamation" onClose={() => setModal(null)}>
      <form onSubmit={submitFeedback}>
        <div className="two-columns"><label>Nom complet<input name="customerName" minLength={3} required /></label><label>Téléphone<input name="customerPhone" type="tel" inputMode="tel" pattern="[+0-9 ]{8,18}" required /></label></div>
        <label>Type<select name="kind" value={feedbackKind} onChange={(event) => setFeedbackKind(event.target.value)}><option value="review">Avis</option><option value="complaint">Réclamation</option></select></label>
        {feedbackKind === "review" && <label>Note<select name="rating" required defaultValue=""><option value="" disabled>Choisissez</option><option value="5">★★★★★ Excellent</option><option value="4">★★★★ Très bien</option><option value="3">★★★ Correct</option><option value="2">★★ À améliorer</option><option value="1">★ Insatisfaisant</option></select></label>}
        <label>Message<textarea name="details" rows={4} minLength={10} maxLength={1000} required /></label>
        <input className="website-field" name="website" tabIndex={-1} autoComplete="off" />
        <button className="form-submit" type="submit" disabled={submitting === "feedback"}>{submitting === "feedback" ? "Enregistrement…" : "Envoyer"}<span>→</span></button>
        {success?.type === "feedback" && <div className="form-success"><strong>Message enregistré · {success.reference}</strong><WhatsAppActions message={success.message} /></div>}{formError.feedback && <p className="form-error">{formError.feedback}</p>}
      </form>
    </Modal>}
  </main>;
}
