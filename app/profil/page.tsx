import Link from "next/link";
import { redirect } from "next/navigation";
import AppBottomNav from "../app-bottom-nav";
import { getPersonalContext } from "../account-auth";
import UnifiedAccess from "./unified-access";

export const dynamic = "force-dynamic";

export default async function ProfileHub({ searchParams }: { searchParams?: Promise<{ returnTo?: string }> }) {
  const personalContext = await getPersonalContext();
  const requestedReturn = (await searchParams)?.returnTo ?? "";
  const returnTo = requestedReturn.startsWith("/") && !requestedReturn.startsWith("//") ? requestedReturn : "";
  if (personalContext) redirect(returnTo || "/espace-expert?tab=profile");

  return (
    <main className="profile-hub role-profile">
      <header className="profile-hub-header">
        <Link className="brand" href="/">
          <span className="brand-mark">AT</span>
          <span><strong>Allô Tchad</strong><small>Services</small></span>
        </Link>
        <span className="profile-header-label">Mon espace</span>
      </header>

      <UnifiedAccess returnTo={returnTo} />

      <AppBottomNav active="profile" />
    </main>
  );
}
