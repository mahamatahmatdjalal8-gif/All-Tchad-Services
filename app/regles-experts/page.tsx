import { TrustPage, TrustSection } from "../trust-page";

export default function ExpertRulesPage() {
  return <TrustPage eyebrow="Code de conduite" title="Règles des experts" intro="L’admission dans le réseau dépend du respect continu de ces règles. Une validation n’est jamais définitive.">
    <TrustSection title="Avant l’admission"><ol><li>Dossier complet et informations exactes.</li><li>Entretien téléphonique.</li><li>Contrôle privé de l’identité et d’au moins une preuve professionnelle.</li><li>Acceptation du code de conduite.</li></ol></TrustSection>
    <TrustSection title="Pendant une mission"><ul><li>Être ponctuel, identifiable, courtois et sobre.</li><li>Diagnostiquer avant d’agir et annoncer le prix total.</li><li>Respecter les règles de sécurité et refuser un travail hors compétence.</li><li>Protéger les biens et la vie privée du client.</li><li>Ne réclamer aucun frais caché.</li></ul></TrustSection>
    <TrustSection title="Publications dans le réseau"><ul><li>Publier uniquement ses propres travaux et des informations professionnelles exactes.</li><li>Obtenir l’accord du client avant toute photo prise chez lui.</li><li>Masquer les visages, numéros, adresses et autres données privées.</li><li>Ne publier aucun contenu trompeur, dangereux, offensant ou sans rapport avec son métier.</li></ul></TrustSection>
    <TrustSection title="Qualité et évaluation"><p>Après une intervention terminée, le client peut attribuer une note sur cinq. Les notes, réclamations et contrôles servent à maintenir, suspendre ou retirer un expert du réseau.</p></TrustSection>
    <TrustSection title="Commission après l’essai"><p>Après la période pilote, l’expert pourra devoir une commission fixe de 1 000 à 3 000 FCFA par intervention réussie. Le montant est fixé avant la mission selon la catégorie du service. Aucune commission ne doit être répercutée en frais cachés au client.</p></TrustSection>
    <TrustSection title="Motifs de retrait"><p>Fausse identité, vol, menace, harcèlement, travail dangereux, abandon injustifié, surfacturation, contournement frauduleux du service ou réclamations graves confirmées.</p></TrustSection>
  </TrustPage>;
}
