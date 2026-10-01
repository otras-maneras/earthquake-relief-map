import type { Metadata } from 'next';
import { interpretesContent, interpretesPath, ALT_LANGUAGES, SITE_URL } from '@/lib/interpretes-i18n';
import InterpretesLanding from '../InterpretesLanding';

export const revalidate = 300;

const t = interpretesContent.en;

export const metadata: Metadata = {
  title: { absolute: t.meta.title },
  description: t.meta.description,
  alternates: {
    canonical: `${SITE_URL}${interpretesPath('en')}`,
    languages: ALT_LANGUAGES,
  },
  openGraph: {
    type: 'website',
    locale: t.ogLocale,
    url: `${SITE_URL}${interpretesPath('en')}`,
    siteName: 'AcopioVE',
    title: t.meta.title,
    description: t.meta.description,
    images: [{ url: '/og-image-v2.png', width: 1200, height: 630, alt: 'AcopioVE' }],
  },
};

export default function InterpretesEnPage() {
  return <InterpretesLanding locale="en" />;
}
