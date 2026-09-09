"use client";

import { FormEvent, useState } from "react";
import "./admin-login.css";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const result = await response
        .json()
        .catch(() => ({})) as {
          error?: string;
          success?: boolean;
        };

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Connexion impossible.",
        );
      }

      const params = new URLSearchParams(
        window.location.search,
      );

      const requested = params.get("return_to") || "/admin";

      const destination =
        requested.startsWith("/") &&
        !requested.startsWith("//")
          ? requested
          : "/admin";

      window.location.assign(destination);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Connexion impossible.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <header>
          <div className="admin-login-logo">AT</div>

          <span>Allô Tchad Services</span>
          <h1>Administration</h1>

          <p>
            Connectez-vous pour accéder au centre de contrôle
            de l'application.
          </p>
        </header>

        <form onSubmit={submit}>
          <label>
            Email administrateur
            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              autoComplete="username"
              placeholder="admin@exemple.com"
              required
            />
          </label>

          <label>
            Mot de passe
            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              autoComplete="current-password"
              required
            />
          </label>

          {error && (
            <p className="admin-login-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy}>
            {busy
              ? "Connexion…"
              : "Accéder à l'administration"}
          </button>
        </form>

        <footer>
          <span>🔒 Session sécurisée</span>
          <a href="/">Retour au site</a>
        </footer>
      </section>
    </main>
  );
}