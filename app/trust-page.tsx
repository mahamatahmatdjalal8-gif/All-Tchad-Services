import Link from "next/link";
import type { ReactNode } from "react";
import "./trust.css";

export function TrustPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return (
    <main className="trust-page">
      <header className="trust-header">
        <Link className="trust-brand" href="/"><span>AT</span><div><strong>Allô Tchad</strong><small>Services</small></div></Link>
        <Link href="/">← Retour au service</Link>
      </header>
      <section className="trust-hero"><span>{eyebrow}</span><h1>{title}</h1><p>{intro}</p></section>
      <article className="trust-document">{children}</article>
      <nav className="trust-links" aria-label="Pages de confiance">
        <Link href="/conditions-utilisation">Conditions d’utilisation</Link>
        <Link href="/confidentialite">Confidentialité</Link>
        <Link href="/regles-experts">Règles des experts</Link>
        <Link href="/procedure-plainte">Procédure de plainte</Link>
        <Link href="/contact">Contact et horaires</Link>
      </nav>
    </main>
  );
}

export function TrustSection({ title, children }: { title: string; children: ReactNode }) {
  return <section><h2>{title}</h2>{children}</section>;
}
