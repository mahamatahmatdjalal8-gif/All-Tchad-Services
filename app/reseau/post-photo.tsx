"use client";

import { useRef } from "react";
import { Maximize2, X } from "lucide-react";

export default function PostPhoto({ src, alt }: { src: string; alt: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button type="button" className="post-photo-button" onClick={() => dialog.current?.showModal()} aria-label={`Agrandir : ${alt}`}>
      <img src={src} alt={alt} loading="lazy" decoding="async" />
      <span className="post-photo-expand"><Maximize2 aria-hidden="true" /></span>
    </button>
    <dialog ref={dialog} className="post-photo-dialog" aria-label={alt} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <button type="button" autoFocus onClick={() => dialog.current?.close()} aria-label="Fermer la photo"><X aria-hidden="true" /></button>
      <img src={src} alt={alt} loading="lazy" />
    </dialog>
  </>;
}
