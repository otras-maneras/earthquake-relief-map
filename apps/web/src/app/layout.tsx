import type { Metadata } from 'next';
import { DM_Sans, Outfit, Fraunces } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});
const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  weight: ['400', '600', '700', '800'],
  display: 'swap',
});
// Serif editorial (titulares y destacados del blog: look "long-read" de diario).
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  style: ['normal', 'italic'],
  display: 'swap',
});

const SITE_URL = 'https://acopiove.org';
const GA_ID = 'G-JDESFJVEKY';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default: 'AcopioVE · Plataforma Humanitaria, Datos Abiertos y HelpMaps',
    template: '%s · AcopioVE',
  },
  description:
    'Plataforma comunitaria de auxilio y datos abiertos ante el terremoto de Venezuela 2026, integrada a la red HelpMaps. Directorio de centros de acopio y refugios en 22 países, documentación técnica, balance institucional y datos abiertos.',

  keywords: [
    'acopiove',
    'helpmaps',
    'helpmaps venezuela',
    'centros de acopio Venezuela',
    'terremoto Venezuela 2026',
    'refugios Venezuela',
    'donaciones Venezuela',
    'donde donar Venezuela',
    'ayuda humanitaria Venezuela',
    'datos abiertos Venezuela',
    'api humanitaria',
    'centros acopio diaspora',
  ],

  authors: [{ name: 'AcopioVE', url: SITE_URL }],
  creator: 'AcopioVE',
  publisher: 'AcopioVE',

  alternates: {
    canonical: SITE_URL,
  },

  manifest: '/manifest.webmanifest',

  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: '/apple-icon.png',
  },

  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'AcopioVE',
  },

  openGraph: {
    type: 'website',
    locale: 'es_VE',
    url: SITE_URL,
    siteName: 'AcopioVE · HelpMaps',
    title: 'AcopioVE · Plataforma Humanitaria, Datos Abiertos y HelpMaps',
    description:
      'Directorio de centros de acopio y refugios en 22 países, documentación técnica de arquitectura, balance institucional y datos abiertos.',
    images: [
      {
        url: '/og-image-v2.png',
        width: 1200,
        height: 630,
        alt: 'AcopioVE + HelpMaps — Plataforma Humanitaria',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'AcopioVE · Plataforma Humanitaria y Datos Abiertos',
    description:
      'Directorio de centros de acopio, documentación de arquitectura, balance institucional y datos abiertos ante el terremoto de Venezuela 2026.',
    images: ['/og-image-v2.png'],
    creator: '@acopiove',
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  verification: {
    google: undefined, // añadir Search Console verification ID si se tiene
  },

  category: 'humanitarian',
};

// JSON-LD structured data (grafo: Organization + WebSite + Dataset).
// Ayuda a buscadores tradicionales (rich results) y a motores de IA (entidad clara y citable).
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'AcopioVE',
      url: SITE_URL,
      logo: `${SITE_URL}/brand/logo-lockup.png`,
      description:
        'Iniciativa humanitaria comunitaria para la respuesta ante el terremoto de Venezuela de 2026, integrada al ecosistema global de HelpMaps (helpmaps.net).',
      sameAs: [
        'https://helpmaps.net',
        'https://instagram.com/acopiove',
        'https://x.com/acopiove',
        'https://github.com/otras-maneras/earthquake-relief-map',
      ],
      areaServed: { '@type': 'Country', name: 'Venezuela' },
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: 'AcopioVE · HelpMaps',
      url: SITE_URL,
      inLanguage: 'es-VE',
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
    {
      '@type': 'Dataset',
      '@id': `${SITE_URL}/#dataset`,
      name: 'Catálogo de Centros de Acopio y Refugios - Terremoto Venezuela 2026',
      description:
        'Conjunto de datos abiertos georreferenciados de centros de acopio, refugios y números de auxilio ante la emergencia humanitaria de 2026.',
      url: `${SITE_URL}/data`,
      license: 'https://creativecommons.org/licenses/by/4.0/',
      creator: { '@id': `${SITE_URL}/#organization` },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-VE" className={`${dmSans.variable} ${outfit.variable} ${fraunces.variable}`}>
      <head>
        {/* Preconnect para acelerar carga de tiles y analytics */}
        <link rel="preconnect" href="https://basemaps.cartocdn.com" />
        <link rel="preconnect" href="https://a.basemaps.cartocdn.com" />
        <link rel="preconnect" href="https://b.basemaps.cartocdn.com" />
        <link rel="preconnect" href="https://c.basemaps.cartocdn.com" />
        <link rel="preconnect" href="https://d.basemaps.cartocdn.com" />
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://www.google-analytics.com" />

        {/* Preload del tile del mapa inicial (Optimizacion LCP) */}
        <link rel="preload" href="https://a.basemaps.cartocdn.com/light_all/1/0/0.png" as="image" fetchPriority="high" />
        <link rel="preload" href="https://a.basemaps.cartocdn.com/light_all/1/0/0@2x.png" as="image" fetchPriority="high" />

        <meta name="theme-color" content="#0a2244" />

        {/* Umami Analytics (condicional por env) */}
        {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (
          <script
            defer
            src={process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL || 'https://cloud.umami.is/script.js'}
            data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
          />
        )}

        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>

      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:bg-white focus:text-ap-primary focus:px-4 focus:py-2 focus:rounded-lg focus:border focus:border-ap-border focus:shadow-md"
        >
          Saltar al contenido principal
        </a>
        {children}

        {/* Google Analytics (Cargado perezosamente en la primera interaccion del usuario para optimizar JS) */}
        <Script id="lazy-google-analytics" strategy="afterInteractive">
          {`
            (function() {
              var loaded = false;
              function loadGA() {
                if (loaded) return;
                loaded = true;
                
                window.removeEventListener('scroll', loadGA);
                window.removeEventListener('mousemove', loadGA);
                window.removeEventListener('touchstart', loadGA);
                window.removeEventListener('keydown', loadGA);

                var script = document.createElement('script');
                script.async = true;
                script.src = 'https://www.googletagmanager.com/gtag/js?id=${GA_ID}';
                document.head.appendChild(script);

                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('config', '${GA_ID}', { page_path: window.location.pathname });
              }

              window.addEventListener('scroll', loadGA, { passive: true });
              window.addEventListener('mousemove', loadGA, { passive: true });
              window.addEventListener('touchstart', loadGA, { passive: true });
              window.addEventListener('keydown', loadGA, { passive: true });
            })();
          `}
        </Script>
      </body>
    </html>
  );
}
