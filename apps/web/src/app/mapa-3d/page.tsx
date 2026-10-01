import type { Metadata } from 'next';
import Mapa3DClient from './Mapa3DClient';

const SITE_URL = 'https://acopiove.org';
const PAGE_URL = `${SITE_URL}/mapa-3d`;
const TITLE = 'Mapa 3D de Edificios Dañados en Catia La Mar (IA) - AcopioVE';
const DESCRIPTION =
  'Vista 3D de edificios en Catia La Mar (La Guaira) evaluados por Microsoft AI for Good Lab: 9.128 polígonos con % de daño estimado sobre imágenes satelitales Vantor del 25 de junio de 2026, publicados en OCHA HDX. Incluye también capas de personas, ayuda y sismos.';

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
    description: DESCRIPTION,
    images: [{ url: '/og-image-v2.png', width: 1200, height: 630, alt: 'AcopioVE Mapa 3D' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og-image-v2.png'],
  },
};

const CAPAS = {
  Daños: [
    { title: 'Daño Satelital (SAR)', sub: 'TerraVE · Sentinel-1 / GEE' },
    { title: 'Edificios Dañados (IA)', sub: 'Catia La Mar · Microsoft AI for Good Lab / OCHA HDX. Altura del edificio = % de daño estimado, no altura real.' },
    { title: 'Daños Estructurales', sub: 'Mapa de Daños VE' },
  ],
  Personas: [
    { title: 'Se busca', sub: 'SOS Venezuela' },
    { title: 'Localizados (Salud)', sub: 'LocVE / CIVIS' },
    { title: 'REDH AVAPRE', sub: 'Hospitalizados y desaparecidos' },
    { title: 'Terremoto Venezuela', sub: 'Ingresos en hospitales' },
  ],
  'Ayuda y necesidades': [
    { title: 'Venezuela Ayuda', sub: 'Hub: personas y solicitudes' },
    { title: 'De Mano en Mano', sub: 'Necesidades por unidad' },
    { title: 'Centros de Insumos', sub: 'Centros Insumos VE' },
  ],
  'Sismos y clima': [
    { title: 'ShakeMap 2026', sub: 'Intensidad sentida USGS' },
    { title: 'Epicentros 2026', sub: 'Doblete Yumare / Morón' },
    { title: 'Réplicas 2026', sub: 'USGS en vivo' },
    { title: 'Terremoto 1967', sub: 'Histórico Caracas' },
    { title: 'Clima por ciudad', sub: 'Open-Meteo' },
    { title: 'Alertas de desastres', sub: 'GDACS' },
    { title: 'Lluvia', sub: 'Radar OpenWeatherMap' },
  ],
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
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
      name: 'Edificios dañados en Catia La Mar — Microsoft AI for Good Lab',
      description:
        'Evaluación de daños por machine learning sobre imágenes satelitales Vantor (25 de junio de 2026) de Microsoft AI for Good Lab, publicada en OCHA HDX. 9.128 polígonos de edificios en Catia La Mar (La Guaira) con % de daño estimado a 0/10/20 metros. Cobertura acotada a esa zona; requiere verificación de campo.',
      creator: { '@type': 'Organization', name: 'Microsoft AI for Good Lab' },
      isBasedOn: 'https://data.humdata.org/dataset/venezuela-earthquakes-catia-la-mar',
      spatialCoverage: 'Catia La Mar, La Guaira, Venezuela',
      temporalCoverage: '2026-06-25',
    },
  ],
};

export default function Mapa3DPage() {
  return (
    <main id="main-content" className="h-[100dvh] w-full overflow-hidden bg-ap-bg font-sans">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="sr-only">
        <h1>Mapa 3D de edificios dañados en Catia La Mar</h1>
        <p>{DESCRIPTION}</p>
        <h2>Capas disponibles</h2>
        {Object.entries(CAPAS).map(([seccion, capas]) => (
          <div key={seccion}>
            <h3>{seccion}</h3>
            <ul>
              {capas.map((c) => (
                <li key={c.title}>
                  {c.title} — {c.sub}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <Mapa3DClient />
    </main>
  );
}
