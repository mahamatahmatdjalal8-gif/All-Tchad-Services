import { TrustPage, TrustSection } from "../trust-page";

export default function ConditionsPage() {
  return <TrustPage eyebrow="Cadre du service" title="Conditions d’utilisation" intro="Les règles essentielles applicables aux clients et aux professionnels qui utilisent Allô Tchad Services.">
    <TrustSection title="1. Rôle d’Allô Tchad Services"><p>Allô Tchad met en relation des clients et des experts indépendants. Le service vérifie les candidatures et facilite le suivi, mais le devis, l’accord sur le prix et l’exécution technique relèvent de l’expert et du client.</p></TrustSection>
    <TrustSection title="2. Demandes et interventions"><ul><li>Le client fournit des informations exactes et une référence joignable.</li><li>L’expert annonce le prix avant de commencer.</li><li>Aucun travail supplémentaire ne peut être facturé sans accord du client.</li><li>Le paiement est effectué directement à l’expert, sauf indication écrite contraire.</li></ul></TrustSection>
    <TrustSection title="3. Sécurité"><p>Le service n’est pas un numéro d’urgence. En cas de danger immédiat, d’incendie, d’électrocution, de fuite importante ou de risque pour les personnes, éloignez-vous du danger et contactez les services compétents.</p></TrustSection>
    <TrustSection title="4. Période pilote et frais"><p>Pendant la période d’essai, aucune commission d’intermédiation n’est due sauf accord préalable clairement annoncé. Après l’essai, une commission fixe comprise entre 1 000 et 3 000 FCFA pourra être appliquée à l’expert pour chaque intervention réussie. Le montant exact est communiqué avant l’acceptation de la mission.</p></TrustSection>
    <TrustSection title="5. Suspension"><p>Allô Tchad peut refuser une demande, suspendre un expert ou limiter l’accès en cas de fraude, violence, harcèlement, fausse information, travail dangereux ou non-respect répété des règles.</p></TrustSection>
  </TrustPage>;
}
