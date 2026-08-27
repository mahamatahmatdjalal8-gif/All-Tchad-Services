"use client";

import { FormEvent, useState } from "react";
import { AtSign, Eye, EyeOff, MessageCircleMore, ShieldCheck, UserRound } from "lucide-react";

export default function UnifiedAccess({ returnTo = "" }: { returnTo?: string }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, action: mode }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error || "Connexion impossible."); setBusy(false); return; }
    // Le compte privé est disponible immédiatement. Les capacités publiques
    // restent liées à la validation ultérieure de la candidature.
    window.location.assign(returnTo || result.next || "/espace-expert?tab=profile");
  }

  return <section className="unified-access-shell personal-access-shell">
    <form className="unified-access-card personal-access-card" onSubmit={submit}>
      <div className="unified-access-icon" aria-hidden="true"><UserRound /></div>
      <span>Compte Allô Tchad</span>
      <h2>{mode === "login" ? "Ouvrir mon espace" : "Créer mon compte"}</h2>
      <p>Demandez un service et discutez avec les experts. Si vous avez une compétence, vous pourrez ensuite déposer votre candidature.</p>
      <div className="personal-access-tabs">
        <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Se connecter</button>
        <button type="button" className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Créer un compte</button>
      </div>
      {mode === "register" && <><label>Nom complet<input name="name" autoComplete="name" minLength={3} placeholder="Votre nom complet" required /></label><label>Ville<input name="city" defaultValue="N’Djamena" required /></label></>}
      <label>Numéro de téléphone<input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+235 66 00 00 00" required /></label>
      <label>Mot de passe<div className="password-field"><input name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} placeholder="6 caractères minimum" required /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} title={showPassword ? "Masquer" : "Afficher"}>{showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button></div></label>
      {error && <p className="unified-access-error">{error}</p>}
      <button className="unified-access-submit" disabled={busy}>{busy ? "Patientez…" : mode === "login" ? "Ouvrir mon compte →" : "Créer mon compte →"}</button>
      <small className="unified-access-help"><ShieldCheck /> Votre compte reste privé. Le profil public et la publication sont activés uniquement après validation de votre candidature.</small>
      <div className="future-auth-providers" aria-label="Méthodes de connexion à venir">
        <button type="button" disabled title="Nécessite la connexion au service officiel"><MessageCircleMore /> WhatsApp / SMS <small>Bientôt</small></button>
        <button type="button" disabled title="Nécessite la connexion à Google"><AtSign /> Google <small>Bientôt</small></button>
      </div>
    </form>
  </section>;
}
