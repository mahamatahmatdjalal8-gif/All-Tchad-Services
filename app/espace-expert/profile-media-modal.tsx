"use client";

import {
  ChangeEvent,
  useEffect,
  useRef,
  useState,
} from "react";

export type ProfileMediaKind = "profile" | "cover";

type Props = {
  kind: ProfileMediaKind;
  open: boolean;
  hasImage: boolean;
  imageUrl: string | null;
  onClose: () => void;
  onChanged: (exists: boolean) => void;
  onNotice: (message: string) => void;
};

const mediaConfig = {
  profile: {
    title: "Photo de profil",
    endpoint: "/api/expert/profile-photo",
    outputWidth: 900,
    outputHeight: 900,
    maxSize: 5 * 1024 * 1024,
  },
  cover: {
    title: "Photo de couverture",
    endpoint: "/api/expert/cover-photo",
    outputWidth: 1620,
    outputHeight: 600,
    maxSize: 8 * 1024 * 1024,
  },
} as const;

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(
      new Error("Impossible de lire cette image."),
    );

    image.src = source;
  });
}

export default function ProfileMediaModal({
  kind,
  open,
  hasImage,
  imageUrl,
  onClose,
  onChanged,
  onNotice,
}: Props) {
  const config = mediaConfig[kind];

  const inputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] =
    useState<"view" | "edit">("view");

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [previewUrl, setPreviewUrl] =
    useState<string | null>(null);

  const [zoom, setZoom] = useState(1);

  const [positionX, setPositionX] =
    useState(50);

  const [positionY, setPositionY] =
    useState(50);

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    setMode(hasImage ? "view" : "edit");
    setZoom(1);
    setPositionX(50);
    setPositionY(50);
    setError("");
  }, [open, hasImage, kind]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!open) {
    return null;
  }

  function chooseImage(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
      ].includes(file.type)
    ) {
      setError(
        "Choisissez une image JPEG, PNG ou WebP.",
      );
      event.target.value = "";
      return;
    }

    if (file.size > config.maxSize) {
      setError(
        kind === "profile"
          ? "La photo ne doit pas dépasser 5 Mo."
          : "La couverture ne doit pas dépasser 8 Mo.",
      );
      event.target.value = "";
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const nextPreview =
      URL.createObjectURL(file);

    setSelectedFile(file);
    setPreviewUrl(nextPreview);
    setZoom(1);
    setPositionX(50);
    setPositionY(50);
    setError("");
    setMode("edit");
  }

  async function createCroppedFile() {
    if (!previewUrl || !selectedFile) {
      throw new Error(
        "Choisissez d’abord une image.",
      );
    }

    const image =
      await loadImage(previewUrl);

    const canvas =
      document.createElement("canvas");

    canvas.width = config.outputWidth;
    canvas.height = config.outputHeight;

    const context =
      canvas.getContext("2d");

    if (!context) {
      throw new Error(
        "Le cadrage est indisponible sur cet appareil.",
      );
    }

    const baseScale = Math.max(
      config.outputWidth / image.naturalWidth,
      config.outputHeight / image.naturalHeight,
    );

    const scale = baseScale * zoom;

    const drawWidth =
      image.naturalWidth * scale;

    const drawHeight =
      image.naturalHeight * scale;

    const overflowX = Math.max(
      0,
      drawWidth - config.outputWidth,
    );

    const overflowY = Math.max(
      0,
      drawHeight - config.outputHeight,
    );

    const drawX =
      -(overflowX * (positionX / 100));

    const drawY =
      -(overflowY * (positionY / 100));

    context.fillStyle = "#ffffff";

    context.fillRect(
      0,
      0,
      config.outputWidth,
      config.outputHeight,
    );

    context.drawImage(
      image,
      drawX,
      drawY,
      drawWidth,
      drawHeight,
    );

    const blob =
      await new Promise<Blob | null>(
        (resolve) => {
          canvas.toBlob(
            resolve,
            "image/jpeg",
            0.9,
          );
        },
      );

    if (!blob) {
      throw new Error(
        "Impossible de préparer l’image.",
      );
    }

    return new File(
      [blob],
      kind === "profile"
        ? "photo-profil.jpg"
        : "photo-couverture.jpg",
      {
        type: "image/jpeg",
      },
    );
  }

  async function saveImage() {
    if (!selectedFile) {
      inputRef.current?.click();
      return;
    }

    setBusy(true);
    setError("");

    try {
      const croppedFile =
        await createCroppedFile();

      const body = new FormData();

      body.append(
        "image",
        croppedFile,
      );

      const response = await fetch(
        config.endpoint,
        {
          method: "POST",
          body,
        },
      );

      const result =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Impossible d’enregistrer l’image.",
        );
      }

      onChanged(true);

      onNotice(
        kind === "profile"
          ? "Photo de profil mise à jour."
          : "Photo de couverture mise à jour.",
      );

      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Impossible d’enregistrer l’image.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteImage() {
    if (!hasImage || busy) return;

    const confirmed = window.confirm(
      kind === "profile"
        ? "Supprimer votre photo de profil ?"
        : "Supprimer votre photo de couverture ?",
    );

    if (!confirmed) return;

    setBusy(true);
    setError("");

    try {
      const response = await fetch(
        config.endpoint,
        {
          method: "DELETE",
        },
      );

      const result =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Suppression impossible.",
        );
      }

      onChanged(false);

      onNotice(
        kind === "profile"
          ? "Photo de profil supprimée."
          : "Photo de couverture supprimée.",
      );

      onClose();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Suppression impossible.",
      );
    } finally {
      setBusy(false);
    }
  }

  const displayedImage =
    mode === "edit"
      ? previewUrl
      : imageUrl;

  return (
    <div
      className="profile-media-modal"
      role="dialog"
      aria-modal="true"
      aria-label={config.title}
    >
      <div className="profile-media-panel">
        <header>
          <button
            type="button"
            className="profile-media-close"
            onClick={onClose}
            aria-label="Fermer"
          >
            ×
          </button>

          <div>
            <span>Allô Tchad Services</span>
            <h2>{config.title}</h2>
          </div>
        </header>

        {mode === "view" && (
          <section className="profile-media-viewer">
            {displayedImage ? (
              <img
                src={displayedImage}
                alt={config.title}
                className={
                  kind === "profile"
                    ? "profile-media-view-profile"
                    : "profile-media-view-cover"
                }
              />
            ) : (
              <div className="profile-media-empty">
                <strong>
                  Aucune image
                </strong>

                <p>
                  Ajoutez une photo pour
                  compléter votre profil.
                </p>
              </div>
            )}
          </section>
        )}

        {mode === "edit" && (
          <section className="profile-media-editor">
            {previewUrl ? (
              <>
                <div
                  className={`profile-media-crop profile-media-crop-${kind}`}
                >
                  <img
                    src={previewUrl}
                    alt="Aperçu du cadrage"
                    style={{
                      objectPosition:
                        `${positionX}% ${positionY}%`,
                      transform:
                        `scale(${zoom})`,
                    }}
                  />

                  {kind === "profile" && (
                    <div className="profile-media-circle-guide" />
                  )}
                </div>

                <div className="profile-media-controls">
                  <label>
                    <span>Zoom</span>

                    <input
                      type="range"
                      min="1"
                      max="2.5"
                      step="0.05"
                      value={zoom}
                      onChange={(event) =>
                        setZoom(
                          Number(
                            event.target.value,
                          ),
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>
                      Horizontal
                    </span>

                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={positionX}
                      onChange={(event) =>
                        setPositionX(
                          Number(
                            event.target.value,
                          ),
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Vertical</span>

                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={positionY}
                      onChange={(event) =>
                        setPositionY(
                          Number(
                            event.target.value,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
              </>
            ) : (
              <button
                type="button"
                className="profile-media-select-first"
                onClick={() =>
                  inputRef.current?.click()
                }
              >
                <strong>
                  📷 Choisir une photo
                </strong>

                <span>
                  JPEG, PNG ou WebP
                </span>
              </button>
            )}
          </section>
        )}

        {error && (
          <p className="profile-media-error">
            {error}
          </p>
        )}

        <footer>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={chooseImage}
          />

          {mode === "view" ? (
            <>
              <button
                type="button"
                onClick={() =>
                  inputRef.current?.click()
                }
              >
                📷{" "}
                {hasImage
                  ? "Changer la photo"
                  : "Ajouter une photo"}
              </button>

              {hasImage && (
                <button
                  type="button"
                  className="danger"
                  disabled={busy}
                  onClick={deleteImage}
                >
                  Supprimer
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  if (hasImage) {
                    setMode("view");
                  } else {
                    onClose();
                  }
                }}
              >
                Annuler
              </button>

              {previewUrl && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    inputRef.current?.click()
                  }
                >
                  Choisir une autre
                </button>
              )}

              <button
                type="button"
                className="primary"
                disabled={
                  busy ||
                  !selectedFile
                }
                onClick={saveImage}
              >
                {busy
                  ? "Enregistrement…"
                  : "Enregistrer"}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}