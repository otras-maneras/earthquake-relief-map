// Contenido de la landing internacional (EN/FR/PT) enfocada en lo que ofrece AcopioVE:
// mapa en vivo de refugios y centros de acopio, info de la emergencia y cómo ayudar.
// El español vive en el mapa principal "/". Sin pasarela de pago todavía.

export const DONATE_LOCALES = ['en', 'fr', 'pt'] as const;
export type DonateLocale = (typeof DONATE_LOCALES)[number];

export const SITE_URL = 'https://acopiove.org';

export function donatePath(locale: DonateLocale): string {
  return locale === 'en' ? '/donate' : `/donate/${locale}`;
}

export const ALT_LANGUAGES: Record<string, string> = {
  en: `${SITE_URL}/donate`,
  fr: `${SITE_URL}/donate/fr`,
  pt: `${SITE_URL}/donate/pt`,
  es: `${SITE_URL}/`,
  'x-default': `${SITE_URL}/donate`,
};

export type FeatureIcon = 'map' | 'shelter' | 'box' | 'phone' | 'globe';

export interface DonateContent {
  htmlLang: string;
  ogLocale: string;
  meta: { title: string; description: string };
  badge: string;
  title: string;
  subtitle: string;
  ctaPrimary: { label: string; href: string };
  ctaSecondary: { label: string; href: string };

  whatTitle: string;
  whatBody: string;
  features: { icon: FeatureIcon; title: string; desc: string; cta: string; href: string }[];

  contextTitle: string;
  contextBody: string;
  stats: { value: string; label: string }[];

  waysTitle: string;
  ways: { title: string; desc: string; cta: string; href: string }[];
  soon: string;

  channels: { title: string; subtitle: string; donate: string };

  faqTitle: string;
  faq: { q: string; a: string }[];

  transparency: { title: string; body: string };
  backToMap: string;
  langLabel: string;
}

export const donateContent: Record<DonateLocale, DonateContent> = {
  en: {
    htmlLang: 'en',
    ogLocale: 'en_US',
    meta: {
      title: 'Venezuela Earthquake 2026: Shelters, Aid Centers & How to Help · AcopioVE',
      description:
        'Live map of emergency shelters and donation centers after the June 2026 Venezuela earthquakes (M7.2 & M7.5). Find verified aid points, emergency contacts and ways to help from abroad.',
    },
    badge: 'Venezuela Earthquake Relief · June 2026',
    title: 'Venezuela earthquake: find shelters, aid centers and how to help',
    subtitle:
      'After the M7.2 and M7.5 earthquakes of June 24, 2026, AcopioVE is the live, community-verified map of emergency shelters, donation centers and emergency contacts across Venezuela. Wherever you are, you can find help or give it.',
    ctaPrimary: { label: 'Open the live map', href: '/' },
    ctaSecondary: { label: 'See emergency shelters', href: '/refugios' },

    whatTitle: 'What is AcopioVE?',
    whatBody:
      'AcopioVE is a free, community-run emergency platform that maps, in real time, where to find shelter and where to bring or send donations after the 2026 Venezuela earthquakes. All points are verified and updated continuously, in Venezuela and across the diaspora.',
    features: [
      { icon: 'map', title: 'Live interactive map', desc: 'Hundreds of verified points with status (open / full / closed), updated in real time.', cta: 'Open the map', href: '/' },
      { icon: 'shelter', title: 'Emergency shelters', desc: 'Official and community shelters in Caracas, La Guaira and beyond — where to stay safe.', cta: 'View shelters', href: '/refugios' },
      { icon: 'box', title: 'Donation centers', desc: 'Collection points for water, food, medicine and supplies, by city and country.', cta: 'View aid centers', href: '/centros' },
      { icon: 'globe', title: 'Diaspora logistics', desc: 'Verified coordinators who organize shipments of aid to Venezuela from abroad.', cta: 'Logistics contacts', href: '/?modal=coordinadores' },
    ],

    contextTitle: 'What happened',
    contextBody:
      'On June 24, 2026, two major earthquakes struck north-central Venezuela 39 seconds apart, with epicenters in Yaracuy state. La Guaira was the hardest hit, with over 100 buildings collapsed in Caraballeda and Catia La Mar, and serious damage in Caracas. It is the strongest earthquake to hit Venezuela in over a century, followed by dozens of aftershocks.',
    stats: [
      { value: 'M7.5', label: 'Main earthquake (Mw)' },
      { value: 'Jun 24, 2026', label: 'Date of the doublet' },
      { value: 'La Guaira', label: 'Hardest-hit region' },
    ],

    waysTitle: 'Ways to help from abroad',
    ways: [
      { title: 'Send aid through diaspora hubs', desc: 'Verified coordinators across the US, Europe and Latin America organize shipments of supplies to Venezuela.', cta: 'See logistics contacts', href: '/?modal=coordinadores' },
      { title: 'Donate to verified organizations', desc: 'Official channels responding on the ground, such as World Central Kitchen and Cáritas Venezuela.', cta: 'See donation channels', href: '/?modal=donaciones' },
      { title: 'Volunteer as an interpreter', desc: 'Interpreters and remote helpers support affected families who need translation or guidance.', cta: 'Volunteer hub', href: '/?modal=voluntarios' },
    ],
    soon: 'Direct online donations through AcopioVE are coming soon.',

    channels: {
      title: 'Verified donation channels',
      subtitle: 'Official organizations responding on the ground. Donating opens their page in a new tab.',
      donate: 'Donate',
    },

    faqTitle: 'Frequently asked questions',
    faq: [
      { q: 'How can I help Venezuela after the earthquake from abroad?', a: 'You can donate to verified organizations responding on the ground, contact diaspora logistics coordinators who ship supplies to Venezuela, or volunteer remotely as an interpreter. All channels are listed on AcopioVE.' },
      { q: 'Where can I find emergency shelters in Caracas and La Guaira?', a: 'AcopioVE keeps a live, verified list of shelters by city. See the shelters page or open the interactive map and filter by "shelters".' },
      { q: 'Is AcopioVE official or government-run?', a: 'No. AcopioVE is an independent, community-run emergency map. We verify and update points from trusted sources so help reaches families directly.' },
      { q: 'What supplies are most needed?', a: 'Drinking water, non-perishable food, medicine and first-aid supplies, blankets and personal hygiene items are the most requested.' },
    ],

    transparency: {
      title: 'Transparency first',
      body: 'AcopioVE is a community-run emergency map. We list verified centers and coordinators so your help reaches families directly. We will publish full payment and fund-handling details before enabling online donations.',
    },
    backToMap: '← Back to the live map',
    langLabel: 'Language',
  },

  fr: {
    htmlLang: 'fr',
    ogLocale: 'fr_FR',
    meta: {
      title: 'Séisme au Venezuela 2026 : refuges, centres d’aide et comment aider · AcopioVE',
      description:
        'Carte en direct des refuges d’urgence et centres de dons après les séismes de juin 2026 au Venezuela (M7,2 et M7,5). Points d’aide vérifiés, contacts d’urgence et comment aider depuis l’étranger.',
    },
    badge: 'Aide au séisme du Venezuela · Juin 2026',
    title: 'Séisme au Venezuela : refuges, centres d’aide et comment aider',
    subtitle:
      'Après les séismes de M7,2 et M7,5 du 24 juin 2026, AcopioVE est la carte en direct, vérifiée par la communauté, des refuges d’urgence, centres de dons et contacts d’urgence au Venezuela. Où que vous soyez, trouvez de l’aide ou apportez-en.',
    ctaPrimary: { label: 'Ouvrir la carte en direct', href: '/' },
    ctaSecondary: { label: 'Voir les refuges d’urgence', href: '/refugios' },

    whatTitle: 'Qu’est-ce qu’AcopioVE ?',
    whatBody:
      'AcopioVE est une plateforme d’urgence gratuite et communautaire qui cartographie en temps réel où trouver un refuge et où apporter ou envoyer des dons après les séismes de 2026 au Venezuela. Tous les points sont vérifiés et mis à jour en continu, au Venezuela et dans la diaspora.',
    features: [
      { icon: 'map', title: 'Carte interactive en direct', desc: 'Des centaines de points vérifiés avec leur statut (ouvert / plein / fermé), mis à jour en temps réel.', cta: 'Ouvrir la carte', href: '/' },
      { icon: 'shelter', title: 'Refuges d’urgence', desc: 'Refuges officiels et communautaires à Caracas, La Guaira et au-delà — où se mettre à l’abri.', cta: 'Voir les refuges', href: '/refugios' },
      { icon: 'box', title: 'Centres de dons', desc: 'Points de collecte d’eau, nourriture, médicaments et fournitures, par ville et pays.', cta: 'Voir les centres', href: '/centros' },
      { icon: 'globe', title: 'Logistique de la diaspora', desc: 'Coordinateurs vérifiés qui organisent l’envoi d’aide vers le Venezuela depuis l’étranger.', cta: 'Contacts logistiques', href: '/?modal=coordinadores' },
    ],

    contextTitle: 'Ce qui s’est passé',
    contextBody:
      'Le 24 juin 2026, deux séismes majeurs ont frappé le centre-nord du Venezuela à 39 secondes d’intervalle, avec des épicentres dans l’État de Yaracuy. La Guaira a été la plus touchée, avec plus de 100 bâtiments effondrés à Caraballeda et Catia La Mar, et de graves dégâts à Caracas. C’est le séisme le plus fort au Venezuela depuis plus d’un siècle, suivi de dizaines de répliques.',
    stats: [
      { value: 'M7,5', label: 'Séisme principal (Mw)' },
      { value: '24 juin 2026', label: 'Date du doublet' },
      { value: 'La Guaira', label: 'Région la plus touchée' },
    ],

    waysTitle: 'Comment aider depuis l’étranger',
    ways: [
      { title: 'Envoyer de l’aide via la diaspora', desc: 'Des coordinateurs vérifiés aux États-Unis, en Europe et en Amérique latine organisent l’envoi de fournitures au Venezuela.', cta: 'Voir les contacts logistiques', href: '/?modal=coordinadores' },
      { title: 'Donner à des organisations vérifiées', desc: 'Des canaux officiels présents sur le terrain, comme World Central Kitchen et Cáritas Venezuela.', cta: 'Voir les canaux de dons', href: '/?modal=donaciones' },
      { title: 'Devenir interprète bénévole', desc: 'Interprètes et bénévoles à distance aident les familles qui ont besoin de traduction ou d’orientation.', cta: 'Espace bénévoles', href: '/?modal=voluntarios' },
    ],
    soon: 'Les dons en ligne directs via AcopioVE arrivent bientôt.',

    channels: {
      title: 'Canaux de don vérifiés',
      subtitle: 'Organisations officielles présentes sur le terrain. Le don ouvre leur page dans un nouvel onglet.',
      donate: 'Faire un don',
    },

    faqTitle: 'Questions fréquentes',
    faq: [
      { q: 'Comment aider le Venezuela après le séisme depuis l’étranger ?', a: 'Vous pouvez faire un don à des organisations vérifiées présentes sur le terrain, contacter les coordinateurs logistiques de la diaspora qui envoient des fournitures au Venezuela, ou être bénévole à distance comme interprète. Tous les canaux sont listés sur AcopioVE.' },
      { q: 'Où trouver des refuges d’urgence à Caracas et La Guaira ?', a: 'AcopioVE tient une liste en direct et vérifiée des refuges par ville. Consultez la page des refuges ou ouvrez la carte interactive et filtrez par « refuges ».' },
      { q: 'AcopioVE est-il officiel ou gouvernemental ?', a: 'Non. AcopioVE est une carte d’urgence indépendante et communautaire. Nous vérifions et mettons à jour les points à partir de sources fiables pour que l’aide parvienne directement aux familles.' },
      { q: 'Quelles fournitures sont les plus nécessaires ?', a: 'Eau potable, nourriture non périssable, médicaments et premiers secours, couvertures et articles d’hygiène personnelle sont les plus demandés.' },
    ],

    transparency: {
      title: 'La transparence d’abord',
      body: 'AcopioVE est une carte d’urgence gérée par la communauté. Nous référençons des centres et coordinateurs vérifiés pour que votre aide parvienne directement aux familles. Nous publierons tous les détails de paiement avant d’activer les dons en ligne.',
    },
    backToMap: '← Retour à la carte en direct',
    langLabel: 'Langue',
  },

  pt: {
    htmlLang: 'pt',
    ogLocale: 'pt_BR',
    meta: {
      title: 'Terremoto na Venezuela 2026: abrigos, centros de ajuda e como ajudar · AcopioVE',
      description:
        'Mapa ao vivo de abrigos de emergência e centros de doação após os terremotos de junho de 2026 na Venezuela (M7,2 e M7,5). Pontos de ajuda verificados, contatos de emergência e como ajudar do exterior.',
    },
    badge: 'Ajuda ao terremoto na Venezuela · Junho 2026',
    title: 'Terremoto na Venezuela: abrigos, centros de ajuda e como ajudar',
    subtitle:
      'Após os terremotos de M7,2 e M7,5 de 24 de junho de 2026, o AcopioVE é o mapa ao vivo, verificado pela comunidade, de abrigos de emergência, centros de doação e contatos de emergência na Venezuela. De onde você estiver, encontre ajuda ou ofereça-a.',
    ctaPrimary: { label: 'Abrir o mapa ao vivo', href: '/' },
    ctaSecondary: { label: 'Ver abrigos de emergência', href: '/refugios' },

    whatTitle: 'O que é o AcopioVE?',
    whatBody:
      'O AcopioVE é uma plataforma de emergência gratuita e comunitária que mapeia em tempo real onde encontrar abrigo e onde levar ou enviar doações após os terremotos de 2026 na Venezuela. Todos os pontos são verificados e atualizados continuamente, na Venezuela e na diáspora.',
    features: [
      { icon: 'map', title: 'Mapa interativo ao vivo', desc: 'Centenas de pontos verificados com status (aberto / lotado / fechado), atualizados em tempo real.', cta: 'Abrir o mapa', href: '/' },
      { icon: 'shelter', title: 'Abrigos de emergência', desc: 'Abrigos oficiais e comunitários em Caracas, La Guaira e além — onde se proteger.', cta: 'Ver abrigos', href: '/refugios' },
      { icon: 'box', title: 'Centros de doação', desc: 'Pontos de coleta de água, comida, remédios e suprimentos, por cidade e país.', cta: 'Ver centros', href: '/centros' },
      { icon: 'globe', title: 'Logística da diáspora', desc: 'Coordenadores verificados que organizam o envio de ajuda para a Venezuela do exterior.', cta: 'Contatos de logística', href: '/?modal=coordinadores' },
    ],

    contextTitle: 'O que aconteceu',
    contextBody:
      'Em 24 de junho de 2026, dois grandes terremotos atingiram o centro-norte da Venezuela com 39 segundos de diferença, com epicentros no estado de Yaracuy. La Guaira foi a mais atingida, com mais de 100 prédios desabados em Caraballeda e Catia La Mar, e graves danos em Caracas. É o terremoto mais forte na Venezuela em mais de um século, seguido por dezenas de réplicas.',
    stats: [
      { value: 'M7,5', label: 'Terremoto principal (Mw)' },
      { value: '24 jun 2026', label: 'Data do dobrete' },
      { value: 'La Guaira', label: 'Região mais atingida' },
    ],

    waysTitle: 'Como ajudar do exterior',
    ways: [
      { title: 'Enviar ajuda pela diáspora', desc: 'Coordenadores verificados nos EUA, Europa e América Latina organizam o envio de suprimentos para a Venezuela.', cta: 'Ver contatos de logística', href: '/?modal=coordinadores' },
      { title: 'Doar a organizações verificadas', desc: 'Canais oficiais atuando no terreno, como World Central Kitchen e Cáritas Venezuela.', cta: 'Ver canais de doação', href: '/?modal=donaciones' },
      { title: 'Ser intérprete voluntário', desc: 'Intérpretes e voluntários remotos apoiam famílias que precisam de tradução ou orientação.', cta: 'Espaço de voluntários', href: '/?modal=voluntarios' },
    ],
    soon: 'As doações on-line diretas pelo AcopioVE chegarão em breve.',

    channels: {
      title: 'Canais de doação verificados',
      subtitle: 'Organizações oficiais atuando no terreno. Doar abre a página delas em uma nova aba.',
      donate: 'Doar',
    },

    faqTitle: 'Perguntas frequentes',
    faq: [
      { q: 'Como ajudar a Venezuela após o terremoto do exterior?', a: 'Você pode doar para organizações verificadas que atuam no terreno, contatar coordenadores de logística da diáspora que enviam suprimentos para a Venezuela, ou ser voluntário remoto como intérprete. Todos os canais estão no AcopioVE.' },
      { q: 'Onde encontrar abrigos de emergência em Caracas e La Guaira?', a: 'O AcopioVE mantém uma lista ao vivo e verificada de abrigos por cidade. Veja a página de abrigos ou abra o mapa interativo e filtre por "abrigos".' },
      { q: 'O AcopioVE é oficial ou do governo?', a: 'Não. O AcopioVE é um mapa de emergência independente e comunitário. Verificamos e atualizamos os pontos a partir de fontes confiáveis para que a ajuda chegue diretamente às famílias.' },
      { q: 'Quais suprimentos são mais necessários?', a: 'Água potável, alimentos não perecíveis, remédios e itens de primeiros socorros, cobertores e itens de higiene pessoal são os mais pedidos.' },
    ],

    transparency: {
      title: 'Transparência em primeiro lugar',
      body: 'O AcopioVE é um mapa de emergência mantido pela comunidade. Listamos centros e coordenadores verificados para que sua ajuda chegue diretamente às famílias. Publicaremos todos os detalhes de pagamento antes de habilitar doações on-line.',
    },
    backToMap: '← Voltar ao mapa ao vivo',
    langLabel: 'Idioma',
  },
};
