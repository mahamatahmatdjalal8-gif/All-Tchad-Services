import Link from "next/link";

type ActiveTab = "home" | "search" | "realizations" | "experts" | "profile";

export default function AppBottomNav({ active }: { active: ActiveTab }) {
  return <nav className="mobile-bottom-nav" aria-label="Navigation principale">
    <Link className={active === "home" ? "active" : ""} href="/"><i aria-hidden="true">⌂</i><span>Accueil</span></Link>
    <Link className={active === "realizations" ? "active" : ""} href="/reseau"><i aria-hidden="true">▤</i><span>Réalisations</span></Link>
    <Link className="bottom-create" href="/#demande"><i aria-hidden="true">＋</i><span>Demande</span></Link>
    <Link className={active === "experts" ? "active" : ""} href="/experts"><i aria-hidden="true">👥</i><span>Experts</span></Link>
    <Link className={active === "profile" ? "active" : ""} href="/profil"><i aria-hidden="true">♙</i><span>Profil</span></Link>
  </nav>;
}
