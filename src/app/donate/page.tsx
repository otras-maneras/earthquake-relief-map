import type { Metadata } from 'next';
import { ALT_LANGUAGES, SITE_URL, donateContent } from '@/lib/donate-i18n';
import DonateLanding from './DonateLanding';

const t = donateContent.en;

export const metadata: Metadata = {
  title: { absolute: t.meta.title },
  description: t.meta.description,
  alternates: {
    canonical: `${SITE_URL}/donate`,
    languages: ALT_LANGUAGES,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: `${SITE_URL}/donate`,
    siteName: 'AcopioVE',
    title: t.meta.title,
    description: t.meta.description,
    images: [{ url: '/og-image-v2.png', width: 1200, height: 630, alt: 'AcopioVE' }],
  },
};

// Landing en inglés (idioma por defecto, sin prefijo). Estática.
export default function DonatePage() {
  return <DonateLanding locale="en" />;
}
