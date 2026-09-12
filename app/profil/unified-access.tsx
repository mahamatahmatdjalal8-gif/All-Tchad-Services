"use client";

import { FormEvent, useState } from "react";
import { AtSign, Eye, EyeOff, MessageCircleMore, ShieldCheck, UserRound } from "lucide-react";

export default function UnifiedAccess({ returnTo = "" }: { returnTo?: string }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, action: mode }), signal: controller.signal });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true) {
        setError(response.status === 429
          ? "Trop de tentatives. Patientez une minute avant de réessayer."
          : typeof result?.error === "string" ? result.error : "Le serveur ne répond pas correctement. Réessayez dans un instant.");
        return;
      }
      const next = returnTo || result.next;
      window.location.assign(typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
        ? next : "/espace-expert?tab=profile");
    } catch {
      setError(controller.signal.aborted
        ? "La demande prend trop de temps. Si vous créiez un compte, essayez de vous connecter : sa création a peut-être abouti."
        : "Connexion interrompue. Vérifiez votre réseau puis réessayez. Si vous créiez un compte, essayez de vous connecter.");
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
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
