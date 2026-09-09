"use client";

import { useEffect, useState } from "react";

type MediaKind = "profile" | "cover";

type Props = {
  kind: MediaKind;
  expertId: number;
  name: string;
  trade: string;
  area: string;
  hasProfilePhoto: boolean;
  hasCoverPhoto: boolean;
};

export default function PublicProfileMedia({
  kind,
  expertId,
  name,
  trade,
  area,
  hasProfilePhoto,
  hasCoverPhoto,
}: Props) {
  const [open, setOpen] = useState(false);
  const [activeKind, setActiveKind] =
    useState<MediaKind>(kind);

  const hasActiveImage =
    activeKind === "profile"
      ? hasProfilePhoto
      : hasCoverPhoto;

  const activeUrl =
    activeKind === "profile"
      ? `/api/expert/profile-photo?id=${expertId}`
      : `/api/expert/cover-photo?id=${expertId}`;

  const availableKinds: MediaKind[] = [];

  if (hasProfilePhoto) {
    availableKinds.push("profile");
  }

  if (hasCoverPhoto) {
    availableKinds.push("cover");
  }

  useEffect(() => {
    if (!open) return;

    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeWithEscape);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener(
        "keydown",
        closeWithEscape,
      );
    };
  }, [open]);

  function openViewer(selected: MediaKind) {
    const exists =
      selected === "profile"
        ? hasProfilePhoto
        : hasCoverPhoto;

    if (!exists) return;

    setActiveKind(selected);
    setOpen(true);
  }

  function move(direction: -1 | 1) {
    if (availableKinds.length < 2) return;

    const currentIndex =
      availableKinds.indexOf(activeKind);

    const nextIndex =
      (
        currentIndex +
        direction +
        availableKinds.length
      ) % availableKinds.length;

    setActiveKind(
      availableKinds[nextIndex],
    );
  }

  return (
    <>
      {kind === "cover" ? (
        <div
          className={`public-profile-cover ${
            hasCoverPhoto ? "has-photo" : ""
          }`}
        >
          {hasCoverPhoto ? (
            <button
              type="button"
              className="public-media-cover-button"
              onClick={() => openViewer("cover")}
              aria-label="Voir la photo de couverture"
            >
              <img
                src={`/api/expert/cover-photo?id=${expertId}`}
                alt="Couverture professionnelle"
              />
            </button>
          ) : (
            <>
              <b>{trade}</b>
              <span>{area}</span>
            </>
          )}
        </div>
      ) : (
        <div className="public-profile-avatar">
          {hasProfilePhoto ? (
            <button
              type="button"
              className="public-media-avatar-button"
              onClick={() => openViewer("profile")}
              aria-label={`Voir la photo de ${name}`}
            >
              <img
                src={`/api/expert/profile-photo?id=${expertId}`}
                alt={`Photo de ${name}`}
              />
            </button>
          ) : (
            name.slice(0, 1).toUpperCase()
          )}
        </div>
      )}

      {open && hasActiveImage && (
        <div
          className="public-media-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={
            activeKind === "profile"
              ? `Photo de profil de ${name}`
              : `Couverture de ${name}`
          }
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <header>
            <div>
              <span>
                {activeKind === "profile"
                  ? "Photo de profil"
                  : "Photo de couverture"}
              </span>

              <strong>{name}</strong>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer"
            >
              ×
            </button>
          </header>

          <section>
            {availableKinds.length > 1 && (
              <button
                type="button"
                className="public-media-arrow previous"
                onClick={() => move(-1)}
                aria-label="Image précédente"
              >
                ‹
              </button>
            )}

            <img
              key={activeKind}
              src={activeUrl}
              alt={
                activeKind === "profile"
                  ? `Photo de profil de ${name}`
                  : `Photo de couverture de ${name}`
              }
              className={
                activeKind === "profile"
                  ? "public-media-full-profile"
                  : "public-media-full-cover"
              }
            />

            {availableKinds.length > 1 && (
              <button
                type="button"
                className="public-media-arrow next"
                onClick={() => move(1)}
                aria-label="Image suivante"
              >
                ›
              </button>
            )}
          </section>

          {availableKinds.length > 1 && (
            <footer>
              <button
                type="button"
                className={
                  activeKind === "profile"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setActiveKind("profile")
                }
              >
                Photo de profil
              </button>

              <button
                type="button"
                className={
                  activeKind === "cover"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setActiveKind("cover")
                }
              >
                Couverture
              </button>
            </footer>
          )}
        </div>
      )}
    </>
  );
}