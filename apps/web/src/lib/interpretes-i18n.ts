// Contenido de la landing de voluntarios intérpretes (ES principal, EN alterno).
// Pensada para SEO: gente afectada / organizaciones buscan intérpretes, e
// intérpretes que quieren sumarse. La lista real se carga aparte (getVoluntarios).

export const INTERPRETES_LOCALES = ['es', 'en'] as const;
export type InterpretesLocale = (typeof INTERPRETES_LOCALES)[number];

export const SITE_URL = 'https://acopiove.org';

export function interpretesPath(locale: InterpretesLocale): string {
  return locale === 'es' ? '/interpretes' : '/interpretes/en';
}

export const ALT_LANGUAGES: Record<string, string> = {
  es: `${SITE_URL}/interpretes`,
  en: `${SITE_URL}/interpretes/en`,
  'x-default': `${SITE_URL}/interpretes`,
};

export interface InterpretesContent {
  htmlLang: string;
  ogLocale: string;
  meta: { title: string; description: string };
  badge: string;
  title: string;
  subtitle: string;
  ctaPrimary: string; // ancla a la lista
  ctaSecondary: { label: string; mailto: string }; // sumarse como intérprete

  statsLabels: { interpreters: string; languages: string; remote: string };

  howTitle: string;
  steps: { title: string; desc: string }[];

  listTitle: string;
  listIntro: string;
  sampleNote: string; // aviso de que es una muestra
  staleNote: string; // aviso de copia de respaldo
  emptyNote: string;
  viewAll: string; // ver todos en el mapa
  // etiquetas de cada tarjeta
  card: {
    remote: string;
    outsideVe: string;
    technical: string;
    availability: string;
    support: string;
    whatsapp: string;
    call: string;
  };

  joinTitle: string;
  joinBody: string;
  joinCta: string;

  faqTitle: string;
  faq: { q: string; a: string }[];

  footerNote: string;
  langLabel: string;
}

export const interpretesContent: Record<InterpretesLocale, InterpretesContent> = {
  es: {
    htmlLang: 'es',
    ogLocale: 'es_VE',
    meta: {
      title: 'Voluntarios intérpretes para el terremoto de Venezuela 2026 · AcopioVE',
      description:
        'Directorio de voluntarios intérpretes y traductores para la emergencia del terremoto de Venezuela 2026. Apoyo de idiomas presencial y remoto para familias afectadas, rescatistas y organizaciones. Encontrá un intérprete o sumate como voluntario.',
    },
    badge: 'Apoyo de idiomas · Emergencia Venezuela 2026',
    title: 'Voluntarios intérpretes para la emergencia',
    subtitle:
      'Tras el terremoto del 24 de junio de 2026, intérpretes y traductores voluntarios ayudan a familias afectadas, rescatistas y organizaciones a comunicarse sin barreras de idioma. Encontrá un intérprete disponible o sumate vos como voluntario.',
    ctaPrimary: 'Ver intérpretes disponibles',
    ctaSecondary: { label: '¿Sos intérprete? Sumate', mailto: 'mailto:info@acopiove.org?subject=Quiero%20sumarme%20como%20int%C3%A9rprete%20voluntario' },

    statsLabels: { interpreters: 'Intérpretes voluntarios', languages: 'Idiomas cubiertos', remote: 'Disponibles en remoto' },

    howTitle: 'Cómo funciona',
    steps: [
      { title: 'Buscá por idioma o modalidad', desc: 'Filtrá la lista por idioma y por apoyo presencial (en terreno) o remoto (teléfono/online).' },
      { title: 'Contactá directo', desc: 'Cada intérprete tiene su WhatsApp o teléfono. El contacto es directo, sin intermediarios.' },
      { title: 'Coordinás el apoyo', desc: 'Acordás horario y forma de ayuda. Es trabajo voluntario y gratuito para la emergencia.' },
    ],

    listTitle: 'Intérpretes disponibles',
    listIntro: 'Voluntarios que ofrecen apoyo de idiomas durante la emergencia. Mostramos una muestra; podés ver el directorio completo y filtrarlo en el mapa.',
    sampleNote: 'Muestra del directorio. Ver el listado completo con buscador en el mapa.',
    staleNote: 'Mostrando la última copia disponible; el directorio en vivo no respondió.',
    emptyNote: 'Por ahora no hay intérpretes cargados. Volvé a intentar en unos minutos.',
    viewAll: 'Ver directorio completo en el mapa',
    card: {
      remote: 'Remoto',
      outsideVe: 'Fuera de Venezuela',
      technical: 'Conocimiento técnico',
      availability: 'Disponibilidad',
      support: 'Apoyo',
      whatsapp: 'WhatsApp',
      call: 'Llamar',
    },

    joinTitle: '¿Sos intérprete o traductor?',
    joinBody:
      'Si hablás más de un idioma y querés ayudar, podés sumarte al directorio de voluntarios. Se necesita apoyo de idiomas presencial y remoto: para rescatistas y equipos internacionales, para familias migrantes y para organizaciones que coordinan la ayuda.',
    joinCta: 'Quiero sumarme como voluntario',

    faqTitle: 'Preguntas frecuentes',
    faq: [
      { q: '¿Qué hace un voluntario intérprete en esta emergencia?', a: 'Traduce y facilita la comunicación entre personas afectadas, rescatistas, equipos internacionales y organizaciones de ayuda. Puede ser apoyo presencial en terreno o remoto por teléfono y mensajería.' },
      { q: '¿Cómo encuentro un intérprete?', a: 'En esta página podés ver una muestra del directorio y abrir el listado completo en el mapa, filtrando por idioma y por modalidad (presencial o remota). El contacto con cada intérprete es directo por WhatsApp o teléfono.' },
      { q: '¿Tiene costo?', a: 'No. Es trabajo voluntario y gratuito durante la emergencia. AcopioVE solo pone en contacto; no cobra ni intermedia.' },
      { q: '¿Cómo me sumo como intérprete voluntario?', a: 'Escribinos a info@acopiove.org indicando los idiomas que hablás, tu ubicación y si podés ayudar de forma presencial o remota. Te sumamos al directorio.' },
      { q: '¿Es un servicio oficial?', a: 'No. AcopioVE es una plataforma comunitaria e independiente. El directorio reúne voluntarios verificados a partir de fuentes de la comunidad.' },
    ],

    footerNote:
      'AcopioVE es un proyecto comunitario e independiente para la respuesta al terremoto de Venezuela de 2026. El directorio de intérpretes reúne voluntarios; el contacto es directo y la ayuda es gratuita.',
    langLabel: 'Idioma',
  },

  en: {
    htmlLang: 'en',
    ogLocale: 'en_US',
    meta: {
      title: 'Volunteer Interpreters for the Venezuela Earthquake 2026 · AcopioVE',
      description:
        'Directory of volunteer interpreters and translators for the 2026 Venezuela earthquake emergency. On-site and remote language support for affected families, rescuers and organizations. Find an interpreter or volunteer as one.',
    },
    badge: 'Language support · Venezuela Emergency 2026',
    title: 'Volunteer interpreters for the emergency',
    subtitle:
      'After the June 24, 2026 earthquake, volunteer interpreters and translators help affected families, rescuers and organizations communicate across language barriers. Find an available interpreter or volunteer as one.',
    ctaPrimary: 'See available interpreters',
    ctaSecondary: { label: 'Are you an interpreter? Join', mailto: 'mailto:info@acopiove.org?subject=I%20want%20to%20volunteer%20as%20an%20interpreter' },

    statsLabels: { interpreters: 'Volunteer interpreters', languages: 'Languages covered', remote: 'Available remotely' },

    howTitle: 'How it works',
    steps: [
      { title: 'Search by language or mode', desc: 'Filter the list by language and by on-site (field) or remote (phone/online) support.' },
      { title: 'Reach out directly', desc: 'Each interpreter lists their WhatsApp or phone. Contact is direct, with no middlemen.' },
      { title: 'Coordinate the support', desc: 'Agree on timing and how to help. It is volunteer, free-of-charge work for the emergency.' },
    ],

    listTitle: 'Available interpreters',
    listIntro: 'Volunteers offering language support during the emergency. This is a sample; you can see the full directory and filter it on the map.',
    sampleNote: 'Sample of the directory. See the full searchable list on the map.',
    staleNote: 'Showing the latest available copy; the live directory did not respond.',
    emptyNote: 'No interpreters loaded yet. Please try again in a few minutes.',
    viewAll: 'See the full directory on the map',
    card: {
      remote: 'Remote',
      outsideVe: 'Outside Venezuela',
      technical: 'Technical knowledge',
      availability: 'Availability',
      support: 'Support',
      whatsapp: 'WhatsApp',
      call: 'Call',
    },

    joinTitle: 'Are you an interpreter or translator?',
    joinBody:
      'If you speak more than one language and want to help, you can join the volunteer directory. On-site and remote language support is needed: for rescuers and international teams, for migrant families, and for organizations coordinating aid.',
    joinCta: 'I want to volunteer',

    faqTitle: 'Frequently asked questions',
    faq: [
      { q: 'What does a volunteer interpreter do in this emergency?', a: 'They translate and ease communication between affected people, rescuers, international teams and aid organizations. It can be on-site support in the field or remote support by phone and messaging.' },
      { q: 'How do I find an interpreter?', a: 'On this page you can see a sample of the directory and open the full list on the map, filtering by language and mode (on-site or remote). Contact with each interpreter is direct via WhatsApp or phone.' },
      { q: 'Is there a cost?', a: 'No. It is volunteer, free-of-charge work during the emergency. AcopioVE only connects people; it does not charge or act as a middleman.' },
      { q: 'How do I join as a volunteer interpreter?', a: 'Email us at info@acopiove.org with the languages you speak, your location, and whether you can help on-site or remotely. We will add you to the directory.' },
      { q: 'Is this an official service?', a: 'No. AcopioVE is an independent, community-run platform. The directory gathers volunteers verified from community sources.' },
    ],

    footerNote:
      'AcopioVE is an independent, community-run project for the 2026 Venezuela earthquake response. The interpreter directory gathers volunteers; contact is direct and help is free of charge.',
    langLabel: 'Language',
  },
};
