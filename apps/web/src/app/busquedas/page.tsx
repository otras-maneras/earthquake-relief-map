import type { Metadata } from 'next';
import PersonasClient from './PersonasClient';

const SITE_URL = 'https://acopiove.org';
const PAGE_URL = `${SITE_URL}/busquedas`;
const TITLE = 'Búsqueda de Personas Desaparecidas y Localizadas — Mapa Consolidado - AcopioVE';
const DESCRIPTION =
  'Buscador y mapa consolidado del terremoto de Venezuela 2026: personas reportadas como desaparecidas o localizadas, centros de acopio, refugios, teléfonos, salud, daños y servicios en un solo lugar, con datos conciliados de múltiples fuentes.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: 'website',
    locale: 'es_VE',
    url: PAGE_URL,
    siteName: 'AcopioVE',
    title: TITLE,
    description:
      'Consulte el registro de personas reportadas como desaparecidas o localizadas tras el sismo de Venezuela 2026.',
    images: [{ url: '/og-image-v2.png', width: 1200, height: 630, alt: 'AcopioVE Búsqueda' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og-image-v2.png'],
  },
};

const FUENTES = [
  'SOS Venezuela',
  'Localizados Venezuela',
  'Hub Venezuela Ayuda',
  'AyudaVenezuela.online',
  'REDH AVAPRE',
  'De Mano en Mano',
  'Venezuela Reporta',
  'AcopioVE (centros de acopio, refugios y teléfonos propios)',
];

const FAQS = [
  {
    q: '¿De dónde salen los datos de personas desaparecidas o localizadas?',
    a: 'AcopioVE centraliza reportes públicos de varias fuentes comunitarias y organizaciones independientes: SOS Venezuela, Localizados Venezuela, Hub Venezuela Ayuda, AyudaVenezuela.online, REDH AVAPRE y De Mano en Mano. También consulta ReportaVNZLA bajo demanda cuando se busca por nombre o cédula.',
  },
  {
    q: '¿Qué tan actualizados están los datos?',
    a: 'Los datos se actualizan automáticamente desde cada fuente y pueden contener errores o estar desactualizados, ya que provienen de reportes comunitarios. Siempre conviene verificar con la fuente original antes de tomar una decisión.',
  },
  {
    q: '¿Cómo reporto a una persona o corrijo un dato?',
    a: 'AcopioVE no genera reportes propios: agrega y muestra los que ya publican las fuentes originales. Para reportar o corregir un dato hay que hacerlo directamente en la fuente correspondiente (SOS Venezuela, Localizados Venezuela, Hub Venezuela Ayuda, etc.).',
  },
  {
    q: '¿Cómo se protege la privacidad de las personas listadas?',
    a: 'La cédula se muestra siempre enmascarada (solo los últimos dígitos), nunca se publican teléfonos ni coordenadas GPS exactas (solo una ubicación general), y se omite la ubicación de menores de edad.',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage',
      '@id': `${PAGE_URL}#webpage`,
      url: PAGE_URL,
      name: TITLE,
      description: DESCRIPTION,
      inLanguage: 'es-VE',
      isPartOf: { '@id': `${SITE_URL}/#website` },
      mainEntity: { '@id': `${PAGE_URL}#dataset` },
    },
    {
      '@type': 'Dataset',
      '@id': `${PAGE_URL}#dataset`,
      name: 'Directorio consolidado de la emergencia — terremoto de Venezuela 2026',
      description: DESCRIPTION,
      creator: { '@id': `${SITE_URL}/#organization` },
      variableMeasured: [
        'nombre',
        'estado (desaparecido/localizado)',
        'ubicación general',
        'fuente',
        'centros de acopio',
        'refugios',
        'teléfonos',
        'salud',
        'daños',
        'servicios',
      ],
      spatialCoverage: 'Venezuela',
      temporalCoverage: '2026-06-24/..',
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQS.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ],
};

export default function PersonasPage() {
  return (
    <main id="main-content" className="h-[100dvh] w-full overflow-hidden bg-ap-bg font-sans">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="sr-only">
        <h1>{TITLE}</h1>
        <h2>Sobre estos datos</h2>
        <p>
          Un solo mapa y un solo buscador que cruzan personas reportadas, centros de acopio, refugios,
          teléfonos útiles, puntos de salud, daños y reportes de servicios. Los datos provienen de fuentes
          públicas y comunitarias; AcopioVE los centraliza y concilia para facilitar la búsqueda, y marca
          cuándo una ficha está confirmada por varias fuentes. Pueden contener errores o estar
          desactualizados: verificá siempre con la fuente original.
        </p>
        <h3>Fuentes</h3>
        <ul>
          {FUENTES.map((f) => (
            <li key={f}>{f}</li>
          ))}
          <li>ReportaVNZLA (bajo demanda, vía búsqueda por nombre o cédula)</li>
        </ul>
        <h2>Preguntas frecuentes</h2>
        {FAQS.map((f) => (
          <div key={f.q}>
            <h3>{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
      </div>
      <PersonasClient />
    </main>
  );
}
