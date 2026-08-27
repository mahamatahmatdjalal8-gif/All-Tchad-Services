import { TrustPage, TrustSection } from "../trust-page";

export default function ComplaintPage() {
  return <TrustPage eyebrow="Assistance client" title="Procédure de plainte" intro="Une procédure simple, confidentielle et traçable pour signaler une mauvaise intervention ou un comportement inacceptable.">
    <TrustSection title="1. Envoyer la plainte"><p>Utilisez le formulaire « Avis et réclamations » du site. Indiquez votre nom, votre téléphone, la référence de la demande et un récit précis des faits. N’envoyez pas publiquement de pièce d’identité ni d’information bancaire.</p></TrustSection>
    <TrustSection title="2. Accusé de réception"><p>Le site attribue immédiatement une référence à la plainte. Conservez-la pour tout suivi.</p></TrustSection>
    <TrustSection title="3. Examen"><p>L’équipe vérifie la demande, contacte le client et l’expert, puis peut demander des photos, un devis ou toute autre preuve utile par un canal privé.</p></TrustSection>
    <TrustSection title="4. Décision"><p>Selon les faits : médiation, correction de l’intervention, avertissement, suspension ou retrait de l’expert. Allô Tchad ne remplace pas les autorités compétentes et peut recommander un recours externe pour les faits graves.</p></TrustSection>
    <TrustSection title="Délais indicatifs" ><p>Premier examen pendant les heures de service, généralement sous deux jours ouvrés. Les dossiers complexes peuvent nécessiter davantage de temps.</p></TrustSection>
  </TrustPage>;
}
