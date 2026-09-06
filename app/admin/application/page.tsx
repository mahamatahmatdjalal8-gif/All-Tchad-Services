import Link from "next/link";
import { requireAdminPage } from "../../admin-access";
import ApplicationControl from "./ApplicationControl";
import "./application.css";

export const dynamic = "force-dynamic";

export default async function ApplicationAdminPage() {
  const user = await requireAdminPage();

  if (!user) {
    return (
      <main className="application-denied">
        <h1>Accès non autorisé</h1>
        <p>
          Cette page est réservée aux administrateurs.
        </p>
        <Link href="/">
          Retour au site
        </Link>
      </main>
    );
  }

  return (
    <main className="application-page">
      <ApplicationControl />
    </main>
  );
}