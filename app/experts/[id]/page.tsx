import Link from "next/link";
import { redirect } from "next/navigation";
import AppBottomNav from "../../app-bottom-nav";
import SocialFeed from "../../reseau/social-feed";
import { getPublicSocialData } from "../../social-data";
import PublicExpertActions from "./public-expert-actions";
import PublicProfileMedia from "./public-profile-media";
import "../../reseau/reseau.css";
import "./profile.css";

export const dynamic = "force-dynamic";

export default async function PublicExpertProfile({ params }: { params: Promise<{ id: string }> }) {
  const expertId = Number((await params).id);
  if (!Number.isInteger(expertId) || expertId < 1) redirect("/experts");
  const allSocialData = await getPublicSocialData({ expertId });
  const expert = allSocialData.experts.find((item) => item.id === expertId);
  if (!expert) redirect("/experts");
  const socialData = JSON.parse(JSON.stringify({ posts: allSocialData.posts, experts: [expert] }));
  return <main className="public-expert-page">
    <header className="public-expert-topbar"><Link href="/"><span>AT</span><strong>Allô Tchad Services</strong></Link><nav><Link href="/reseau">Réalisations</Link><Link href="/experts">Tous les experts</Link></nav></header>
    <section className="public-expert-shell">
      <section className="public-profile-card">
        <PublicProfileMedia
          kind="cover"
          expertId={expert.id}
          name={expert.name}
          trade={expert.trade}
          area={expert.area}
          hasProfilePhoto={expert.hasProfilePhoto}
          hasCoverPhoto={expert.hasCoverPhoto}
        />
        <div className="public-profile-identity"><PublicProfileMedia
  kind="profile"
  expertId={expert.id}
  name={expert.name}
  trade={expert.trade}
  area={expert.area}
  hasProfilePhoto={expert.hasProfilePhoto}
  hasCoverPhoto={expert.hasCoverPhoto}
/><div><h1>{expert.name}<i>✓</i></h1><p>{expert.profileBio || `${expert.trade} professionnel à ${expert.area}`}</p><div className="public-profile-stats"><span><strong>{expert.followerCount}</strong> abonné{expert.followerCount > 1 ? "s" : ""}</span><span><strong>{expert.followingCount || 0}</strong> suivi{(expert.followingCount || 0) > 1 ? "s" : ""}</span><span><strong>{allSocialData.posts.length}</strong> publication{allSocialData.posts.length > 1 ? "s" : ""}</span></div></div><PublicExpertActions expert={expert} /></div>
      </section>
      <section className="public-profile-details"><article><h2>Informations professionnelles</h2><p><b>⌖</b> Travaille à <strong>{expert.area}</strong></p><p><b>⌁</b> Intervient dans <strong>{expert.coverage}</strong></p><p><b>⚒</b> <strong>{expert.trade}</strong> · {expert.experience} an(s) d’expérience</p><p><b>◷</b> {expert.availability}</p>{expert.workingHours && <p><b>▣</b> {expert.workingHours}</p>}</article><article><h2>Publications et réalisations</h2><p>Suivez ce profil pour retrouver ses nouveaux travaux en priorité dans votre fil.</p></article></section>
      <SocialFeed initialData={socialData} mode="profile" />
    </section>
    <AppBottomNav active="search" />
  </main>;
}
