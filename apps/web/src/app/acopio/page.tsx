import type { Metadata } from 'next';
import MapaClient from '../MapaClient';

const SITE_URL = 'https://acopiove.org';

export const metadata: Metadata = {
  title: 'Mapa interactivo de centros de acopio y refugios en Venezuela y la diáspora',
  description:
    'Mapa geoespacial en tiempo real con más de 700 centros de acopio y refugios en Venezuela y 22 países de la diáspora. Semáforo de verificación comunitaria, insumos requeridos y búsqueda por proximidad.',
  keywords: [
    'mapa centros acopio venezuela',
    'refugios terremoto venezuela',
    'donde donar venezuela mapa',
    'centros de acopio diaspora venezuela',
    'acopiove mapa',
    'helpmaps venezuela',
  ],
  alternates: {
    canonical: `${SITE_URL}/acopio`,
  },
  openGraph: {
    type: 'website',
    locale: 'es_VE',
    url: `${SITE_URL}/acopio`,
    siteName: 'AcopioVE · HelpMaps',
    title: 'Mapa interactivo de centros de acopio y refugios · AcopioVE',
    description:
      'Ubica en el mapa los centros de acopio y refugios activos para donar medicinas, alimentos y auxilio en Venezuela y el exterior.',
    images: [
      {
        url: '/og-image-v2.png',
        width: 1200,
        height: 630,
        alt: 'Mapa de centros de acopio AcopioVE',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mapa de Centros de Acopio y Refugios · AcopioVE',
    description:
      'Encuentra en el mapa interactivo dónde donar y refugios habilitados tras la emergencia.',
    images: ['/og-image-v2.png'],
  },
};

export default function AcopioMapPage() {
  return (
    <main id="main-content" className="h-[100dvh] w-full overflow-hidden bg-ap-bg font-sans">
      <MapaClient />
    </main>
  );
}
