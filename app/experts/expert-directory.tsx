"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BriefcaseBusiness, Clock3, MapPin, Search, ShieldCheck, Star } from "lucide-react";
import { categoryForTrade, serviceCategories } from "../service-catalog";

export type PublicExpert = {
  id: number;
  name: string;
  trade: string;
  area: string;
  coverage: string;
  experience: number;
  availability: string;
  rating?: number | null;
  reviewCount?: number;
  completedJobs?: number;
  hasProfilePhoto?: boolean;
};

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function availabilityClass(availability: string) {
  const value = availability.toLocaleLowerCase("fr");
  if (value.includes("indisponible")) return "unavailable";
  if (value.includes("occup")) return "busy";
  return "available";
}

export default function ExpertDirectory({ experts, view = "both" }: { experts: PublicExpert[]; view?: "catalog" | "experts" | "both" }) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [query, setQuery] = useState("");
  const selectedCategory = serviceCategories.find((category) => category.id === activeCategory);

  useEffect(() => {
    if (!selectedCategory || view === "experts") return;
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setActiveCategory("all");
    document.body.classList.add("category-dialog-open");
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("category-dialog-open");
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedCategory, view]);

  const normalizedQuery = query.trim().toLocaleLowerCase("fr");
  const visibleExperts = experts.filter((expert) => {
    const category = categoryForTrade(expert.trade);
    const matchesCategory = activeCategory === "all" || category?.id === activeCategory;
    const haystack = `${expert.name} ${expert.trade} ${expert.area} ${expert.coverage}`.toLocaleLowerCase("fr");
    return matchesCategory && (!normalizedQuery || haystack.includes(normalizedQuery));
  });
  const groupedExperts = serviceCategories.map((category) => ({
    category,
    experts: visibleExperts.filter((expert) => category.trades.includes(expert.trade)),
  })).filter((group) => group.experts.length > 0);

  return <section className="experts-directory">
    {view !== "experts" && <section className="catalog-section" aria-labelledby="catalog-title">
      <div className="directory-heading"><div><span>Catalogue complet</span><h2 id="catalog-title">Choisissez une catégorie</h2><p>Tous les métiers sont rangés clairement. Touchez une catégorie pour afficher les spécialités.</p></div><strong>{serviceCategories.length} catégories · {serviceCategories.reduce((total, category) => total + category.trades.length, 0)} métiers</strong></div>
      <div className="category-grid">
        {serviceCategories.filter((category) => experts.some((expert) => category.trades.includes(expert.trade))).map((category) => {
          const count = experts.filter((expert) => category.trades.includes(expert.trade)).length;
          return <button type="button" key={category.id} className={activeCategory === category.id ? "active" : ""} aria-haspopup="dialog" aria-expanded={activeCategory === category.id} onClick={() => setActiveCategory(category.id)}>
            <span>{category.icon}</span><div><strong>{category.name}</strong><small>{category.trades.length} métiers</small></div><em>{count} expert{count > 1 ? "s" : ""}</em>
            <p>{category.trades.slice(0, 3).join(" · ")}</p>
          </button>;
        })}
      </div>

      {selectedCategory && <div className="category-modal" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setActiveCategory("all")}>
        <article className="category-detail category-dialog" role="dialog" aria-modal="true" aria-labelledby="selected-category-title">
          <header><span>{selectedCategory.icon}</span><div><small>Métiers de la catégorie</small><h3 id="selected-category-title">{selectedCategory.name}</h3><p>{selectedCategory.description}</p></div><button type="button" onClick={() => setActiveCategory("all")} aria-label="Fermer la catégorie">×</button></header>
          <div className="trade-list">{selectedCategory.trades.map((trade) => <Link key={trade} href={`/?service=${encodeURIComponent(trade)}#demande`}>{trade}<span>→</span></Link>)}</div>
          <footer><p>Vous exercez l’un de ces métiers ?</p><Link href="/#artisan">Déposer une candidature</Link></footer>
        </article>
      </div>}
    </section>}

    {view !== "catalog" && <section className="verified-section" aria-labelledby="verified-title">
      <div className="experts-toolbar"><div><span>Annuaire professionnel</span><h2 id="verified-title">Experts vérifiés</h2><p>{visibleExperts.length} résultat{visibleExperts.length !== 1 ? "s" : ""} · {activeCategory === "all" ? "triés par catégorie et par note" : selectedCategory?.name}</p></div><label><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Métier, nom ou quartier…" aria-label="Rechercher un expert" /></label></div>

      <div className="expert-category-filter" aria-label="Filtrer les experts par catégorie">
        <button type="button" className={activeCategory === "all" ? "active" : ""} onClick={() => setActiveCategory("all")}><span>✦</span>Tous</button>
        {serviceCategories.filter((category) => experts.some((expert) => category.trades.includes(expert.trade))).map((category) => {
          const count = experts.filter((expert) => category.trades.includes(expert.trade)).length;
          return <button type="button" key={category.id} className={activeCategory === category.id ? "active" : ""} onClick={() => setActiveCategory(category.id)}><span>{category.icon}</span>{category.name}<em>{count}</em></button>;
        })}
      </div>

      {visibleExperts.length ? <div className="expert-groups">{groupedExperts.map(({ category, experts: categoryExperts }) => <section className="expert-group" key={category.id} aria-labelledby={`expert-category-${category.id}`}>
        <header><div><span>{category.icon}</span><div><h3 id={`expert-category-${category.id}`}>{category.name}</h3><p>{categoryExperts.length} expert{categoryExperts.length > 1 ? "s" : ""} · mieux notés en premier</p></div></div><button type="button" onClick={() => setActiveCategory(category.id)}>Voir seulement cette catégorie</button></header>
        <div className="expert-grid">{categoryExperts.map((expert, index) => <article className={`expert-card category-${category.id}`} key={expert.id}>
          <div className="expert-card-cover" aria-hidden="true"><span>{category.icon}</span></div>
          <div className="expert-card-top">
            <span className="expert-avatar">{expert.hasProfilePhoto ? <img src={`/api/expert/profile-photo?id=${expert.id}`} alt={`Photo de ${expert.name}`} /> : initials(expert.name)}</span>
            <div>{index === 0 && expert.rating && <b>Top de la catégorie</b>}<i><ShieldCheck aria-hidden="true" /> Vérifié</i></div>
          </div>
          <div className="expert-card-body">
            <div className="expert-identity"><small>{category.name}</small><h3><Link href={`/experts/${expert.id}`}>{expert.name}</Link></h3><p>{expert.trade}</p></div>
            <div className="expert-rating">{expert.rating ? <><strong><Star aria-hidden="true" fill="currentColor" /> {expert.rating.toFixed(1)}</strong><span>{expert.reviewCount} avis</span></> : <><strong className="new-expert">Nouveau</strong><span>Pas encore noté</span></>}</div>
            <div className="expert-quick-facts">
              <span><BriefcaseBusiness aria-hidden="true" /><small>Expérience</small><strong>{expert.experience} an{expert.experience > 1 ? "s" : ""}</strong></span>
              <span title={expert.area}><MapPin aria-hidden="true" /><small>Zone</small><strong>{expert.area || "Non précisée"}</strong></span>
            </div>
            <div className="expert-coverage" title={expert.coverage}><MapPin aria-hidden="true" /><span>Intervient à <strong>{expert.coverage || "zone à confirmer"}</strong></span></div>
            <div className={`expert-availability ${availabilityClass(expert.availability)}`}><Clock3 aria-hidden="true" /><span><small>Disponibilité</small><strong>{expert.availability}</strong></span>{typeof expert.completedJobs === "number" && <em>{expert.completedJobs} mission{expert.completedJobs > 1 ? "s" : ""} terminée{expert.completedJobs > 1 ? "s" : ""}</em>}</div>
            <div className="expert-card-actions"><Link href={`/experts/${expert.id}`}>Voir le profil</Link><Link href={`/experts/${expert.id}?demande=1`}>Demander un service <ArrowRight aria-hidden="true" /></Link></div>
          </div>
        </article>)}</div>
      </section>)}</div> : <div className="directory-empty"><span>🧭</span><strong>{experts.length ? "Aucun résultat dans ce filtre" : "Le recrutement est ouvert"}</strong><p>{experts.length ? "Essayez une autre catégorie ou un autre mot." : "Les experts apparaîtront ici après contrôle et acceptation de leur dossier."}</p><div><button type="button" onClick={() => { setActiveCategory("all"); setQuery(""); }}>Voir tous les experts</button><Link href="/#artisan">Candidater comme expert →</Link></div></div>}
    </section>}
  </section>;
}
