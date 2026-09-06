import { desc } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "../../db";
import {
  artisanApplications,
  artisanDocuments,
  feedbackEntries,
  serviceRequests,
} from "../../db/schema";
import { requireAdminPage } from "../admin-access";
import AdminDashboard from "./dashboard";
import "./admin.css";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireAdminPage();

  if (!user) {
    return (
      <main className="admin-denied">
        <div>
          <span>AT</span>
          <h1>Accès non autorisé</h1>
          <p>
            Ce tableau de bord est réservé aux administrateurs
            d’Allô Tchad Services.
          </p>
          <Link href="/">Retour au site</Link>
        </div>
      </main>
    );
  }

  const db = getDb();

  const [requests, artisans, documents, feedback] =
    await Promise.all([
      db
        .select()
        .from(serviceRequests)
        .orderBy(desc(serviceRequests.createdAt))
        .limit(250),

      db
        .select()
        .from(artisanApplications)
        .orderBy(desc(artisanApplications.createdAt))
        .limit(250),

      db
        .select({
          id: artisanDocuments.id,
          applicationId: artisanDocuments.applicationId,
          kind: artisanDocuments.kind,
          originalName: artisanDocuments.originalName,
          contentType: artisanDocuments.contentType,
          size: artisanDocuments.size,
        })
        .from(artisanDocuments)
        .orderBy(desc(artisanDocuments.createdAt))
        .limit(2500),

      db
        .select()
        .from(feedbackEntries)
        .orderBy(desc(feedbackEntries.createdAt))
        .limit(250),
    ]);

  const artisansWithDocuments = artisans.map((artisan) => ({
    ...artisan,
    documents: documents.filter(
      (document) =>
        document.applicationId === artisan.id,
    ),
  }));

  const serializable = JSON.parse(
    JSON.stringify({
      requests,
      artisans: artisansWithDocuments,
      feedback,
    }),
  );

  return (
    <AdminDashboard
      initialData={serializable}
      userName={user.displayName}
      signOutPath="/api/admin/logout"
    />
  );
}