"use client";

import { useEffect, useState } from "react";

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

const defaults: AppSettings = {
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

export default function ApplicationControl() {
  const [settings, setSettings] =
    useState<AppSettings>(defaults);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/admin/app-settings")
      .then(async (response) => {
        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Chargement impossible.",
          );
        }

        if (result.settings) {
          setSettings(result.settings);
        }
      })
      .catch((error) => {
        setNotice(
          error instanceof Error
            ? error.message
            : "Chargement impossible.",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  function update<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function save() {
    setSaving(true);
    setNotice("");

    try {
      const response = await fetch(
        "/api/admin/app-settings",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(settings),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Enregistrement impossible.",
        );
      }

      if (result.settings) {
        setSettings(result.settings);
      }

      setNotice(
        "Paramètres enregistrés avec succès.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Enregistrement impossible.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="application-loading">
        Chargement des paramètres…
      </div>
    );
  }

  return (
    <section className="application-control">
      <header className="application-heading">
        <div>
          <span>Centre de contrôle</span>
          <h1>Application</h1>
          <p>
            Modifiez ce que voient les utilisateurs
            directement depuis votre téléphone.
          </p>
        </div>

        <a href="/admin">
          ← Administration
        </a>
      </header>

      {notice && (
        <div className="application-notice">
          {notice}
        </div>
      )}

      <section className="application-card">
        <header>
          <span>Accueil</span>
          <h2>Présentation principale</h2>
        </header>

        <label>
          Petit texte
          <input
            value={settings.homeEyebrow}
            onChange={(event) =>
              update(
                "homeEyebrow",
                event.target.value,
              )
            }
          />
        </label>

        <label>
          Titre principal
          <input
            value={settings.homeTitle}
            onChange={(event) =>
              update(
                "homeTitle",
                event.target.value,
              )
            }
          />
        </label>

        <label>
          Description
          <textarea
            rows={4}
            value={settings.homeDescription}
            onChange={(event) =>
              update(
                "homeDescription",
                event.target.value,
              )
            }
          />
        </label>

        <label>
          Annonce générale
          <textarea
            rows={3}
            placeholder="Exemple : Nouveau service disponible à N’Djamena."
            value={settings.announcement}
            onChange={(event) =>
              update(
                "announcement",
                event.target.value,
              )
            }
          />
        </label>
      </section>

      <section className="application-card">
        <header>
          <span>Contacts</span>
          <h2>Coordonnées officielles</h2>
        </header>

        <label>
          WhatsApp officiel
          <input
            inputMode="tel"
            value={settings.whatsapp}
            onChange={(event) =>
              update(
                "whatsapp",
                event.target.value,
              )
            }
          />
        </label>

        <label>
          Téléphone officiel
          <input
            inputMode="tel"
            placeholder="+235..."
            value={settings.phone}
            onChange={(event) =>
              update(
                "phone",
                event.target.value,
              )
            }
          />
        </label>
      </section>

      <section className="application-card">
        <header>
          <span>Fonctions</span>
          <h2>Activation des services</h2>
        </header>

        <label className="application-switch">
          <div>
            <strong>Demandes clients</strong>
            <small>
              Autoriser les utilisateurs à envoyer
              de nouvelles demandes.
            </small>
          </div>

          <input
            type="checkbox"
            checked={settings.requestsEnabled}
            onChange={(event) =>
              update(
                "requestsEnabled",
                event.target.checked,
              )
            }
          />
        </label>

        <label className="application-switch">
          <div>
            <strong>Publications</strong>
            <small>
              Afficher les réalisations des experts.
            </small>
          </div>

          <input
            type="checkbox"
            checked={settings.postsEnabled}
            onChange={(event) =>
              update(
                "postsEnabled",
                event.target.checked,
              )
            }
          />
        </label>

        <label className="application-switch danger">
          <div>
            <strong>Mode maintenance</strong>
            <small>
              À utiliser pendant une intervention
              technique importante.
            </small>
          </div>

          <input
            type="checkbox"
            checked={settings.maintenanceMode}
            onChange={(event) =>
              update(
                "maintenanceMode",
                event.target.checked,
              )
            }
          />
        </label>
      </section>

      <button
        className="application-save"
        type="button"
        disabled={saving}
        onClick={save}
      >
        {saving
          ? "Enregistrement…"
          : "Enregistrer les modifications"}
      </button>
    </section>
  );
}