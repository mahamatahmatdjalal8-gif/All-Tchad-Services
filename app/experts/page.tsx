import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "../../db";
import { artisanApplications, feedbackEntries, serviceRequests } from "../../db/schema";
import AppBottomNav from "../app-bottom-nav";
import ExpertDirectory from "./expert-directory";
import "./experts.css";

export const dynamic = "force-dynamic";

export default async function ExpertsPage() {
  const db = getDb();
  const [acceptedExperts, requests, reviews] = await Promise.all([db.select({
    id: artisanApplications.id,
    name: artisanApplications.name,
    trade: artisanApplications.trade,
    area: artisanApplications.area,
    coverage: artisanApplications.coverage,
    experience: artisanApplications.experience,
    availability: artisanApplications.availability,
    profileImageKey: artisanApplications.profileImageKey,
  }).from(artisanApplications).where(eq(artisanApplications.status, "accepted")).orderBy(asc(artisanApplications.trade), asc(artisanApplications.name)),
  db.select({ reference: serviceRequests.reference, assignedArtisan: serviceRequests.assignedArtisan, status: serviceRequests.status }).from(serviceRequests),
  db.select({ requestReference: feedbackEntries.requestReference, rating: feedbackEntries.rating }).from(feedbackEntries).where(eq(feedbackEntries.kind, "review")),
  ]);

  const requestByReference = new Map(requests.map((request) => [request.reference, request]));
  const experts = acceptedExperts.map((expert) => {
    const expertReviews = reviews.filter((review) => review.rating && review.requestReference && requestByReference.get(review.requestReference)?.assignedArtisan === expert.name);
    const ratingTotal = expertReviews.reduce((total, review) => total + (review.rating ?? 0), 0);
    return {
      ...expert,
      hasProfilePhoto: Boolean(expert.profileImageKey),
      rating: expertReviews.length ? ratingTotal / expertReviews.length : null,
      reviewCount: expertReviews.length,
      completedJobs: requests.filter((request) => request.assignedArtisan === expert.name && request.status === "completed").length,
    };
  }).map(({ profileImageKey: _profileImageKey, ...expert }) => expert).sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || b.reviewCount - a.reviewCount || a.name.localeCompare(b.name, "fr"));

  return <main className="experts-page available-experts-page directory-premium">
    <header className="experts-header"><Link className="experts-brand" href="/"><span>AT</span><div><strong>Allô Tchad</strong><small>Services</small></div></Link><nav aria-label="Navigation de l’annuaire"><Link href="/reseau">Réalisations</Link><Link className="experts-space-link" href="/profil">Mon espace</Link></nav></header>
    <ExpertDirectory experts={experts} view="experts" />
    <footer className="experts-footer"><p>Vous êtes un professionnel qualifié ?</p><Link href="/#artisan">Déposer une candidature</Link></footer>
    <AppBottomNav active="experts" />
  </main>;
}
