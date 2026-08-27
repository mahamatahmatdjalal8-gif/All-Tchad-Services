export type ServiceCategory = {
  id: string;
  name: string;
  icon: string;
  description: string;
  trades: string[];
};

export const serviceCategories: ServiceCategory[] = [
  {
    id: "numerique",
    name: "Téléphone & numérique",
    icon: "📱",
    description: "Réparation, connexion, impression et sécurité numérique.",
    trades: [
      "Réparateur de téléphone",
      "Réparateur d’ordinateur",
      "Technicien d’imprimante",
      "Technicien Wi-Fi et réseau",
      "Installateur de caméras de surveillance",
      "Installateur d’antenne et télévision",
    ],
  },
  {
    id: "energie",
    name: "Électricité & énergie",
    icon: "⚡",
    description: "Courant, solaire, batteries et alimentation de secours.",
    trades: [
      "Électricien",
      "Technicien solaire",
      "Technicien de batteries et onduleurs",
      "Technicien de groupes électrogènes",
    ],
  },
  {
    id: "eau",
    name: "Plomberie & eau",
    icon: "💧",
    description: "Eau, pompage, assainissement et dépannage des installations.",
    trades: [
      "Plombier",
      "Réparateur de pompe à eau",
      "Foreur",
      "Installateur de château d’eau",
      "Vidangeur et technicien d’assainissement",
    ],
  },
  {
    id: "froid",
    name: "Froid & électroménager",
    icon: "❄️",
    description: "Climatisation, conservation au froid et appareils domestiques.",
    trades: [
      "Technicien de climatisation",
      "Réparateur de réfrigérateur",
      "Réparateur d’électroménagers",
      "Technicien de chambre froide",
    ],
  },
  {
    id: "batiment",
    name: "Bâtiment & construction",
    icon: "🏗️",
    description: "Construction, finition, menuiserie et serrurerie.",
    trades: [
      "Maçon",
      "Menuisier bois",
      "Menuisier aluminium",
      "Soudeur",
      "Peintre",
      "Carreleur",
      "Vitrier",
      "Couvreur",
      "Plâtrier",
      "Ferrailleur",
      "Serrurier",
    ],
  },
  {
    id: "mobilite",
    name: "Automobile & moto",
    icon: "🚗",
    description: "Entretien, réparation et dépannage des véhicules.",
    trades: [
      "Mécanicien automobile",
      "Mécanicien moto",
      "Électricien automobile",
      "Réparateur de pneus",
      "Carrossier",
      "Climaticien automobile",
      "Dépanneur automobile",
    ],
  },
  {
    id: "maison",
    name: "Maison & proximité",
    icon: "🏠",
    description: "Entretien du domicile et services pratiques de proximité.",
    trades: [
      "Agent de nettoyage",
      "Désinsectiseur",
      "Jardinier",
      "Déménageur",
      "Couturier ou couturière",
      "Coiffeur ou coiffeuse à domicile",
    ],
  },
  {
    id: "evenementiel",
    name: "Événementiel",
    icon: "🎉",
    description: "Image, décoration, restauration et animation d’événements.",
    trades: [
      "Photographe",
      "Vidéaste",
      "Décorateur événementiel",
      "Traiteur",
      "Pâtissier",
      "DJ et sonorisateur",
      "Loueur de matériel événementiel",
    ],
  },
];

export const allTrades = serviceCategories.flatMap((category) => category.trades);

export function categoryForTrade(trade: string) {
  return serviceCategories.find((category) => category.trades.includes(trade));
}
