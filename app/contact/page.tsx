import Link from "next/link";
import { TrustPage, TrustSection } from "../trust-page";

export default function ContactPage() {
  return <TrustPage eyebrow="Nous joindre" title="Coordonnées et horaires" intro="Allô Tchad Services est un projet pilote basé à N’Djamena et fonctionne principalement en ligne.">
    <TrustSection title="Point de service"><p>N’Djamena, Tchad — service pilote en ligne. Les visites physiques se font uniquement sur rendez-vous confirmé.</p></TrustSection>
    <TrustSection title="Horaires provisoires"><ul><li>Lundi à vendredi : 8 h 00 à 18 h 00</li><li>Samedi : 9 h 00 à 16 h 00</li><li>Dimanche et jours fériés : fermé</li></ul><p>Les formulaires restent accessibles à toute heure et sont traités pendant les horaires d’ouverture.</p></TrustSection>
    <TrustSection title="Canaux de contact"><p>Pour une demande de service, utilisez le <Link href="/#demande">formulaire client</Link>. Pour une candidature, utilisez le <Link href="/#artisan">formulaire expert</Link>. Pour une plainte ou un avis, utilisez le <Link href="/#avis">formulaire de suivi</Link>.</p></TrustSection>
    <section className="trust-callout"><h2>Urgence</h2><p>Allô Tchad Services n’est pas un service d’urgence. Ne restez pas à proximité d’un équipement électrique dangereux, d’un incendie ou d’une fuite importante.</p></section>
  </TrustPage>;
}
