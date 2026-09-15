"use client";

import { useEffect, useRef, useState } from "react";

export default function PublicationPhoto() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    setFailed(false);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const form = input.current?.form;
    const reset = () => { setFile(null); setFailed(false); };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, []);

  return <div className="publication-photo-picker">
    <label>📷 {file ? "Changer la photo" : "Ajouter une photo"}
      <input ref={input} name="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)} />
    </label>
    {file && <figure>
      {preview && !failed && <img src={preview} alt="Aperçu de la photo choisie avant publication" onError={() => setFailed(true)} />}
      {failed && <p role="alert">Impossible d’afficher cette photo. Choisissez une image JPEG, PNG ou WebP.</p>}
      <figcaption>{file.name} · Photo non publiée</figcaption>
      <button type="button" onClick={() => { if (input.current) input.current.value = ""; setFile(null); setFailed(false); }}>Retirer la photo</button>
    </figure>}
  </div>;
}
