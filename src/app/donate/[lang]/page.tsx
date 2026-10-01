import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  ALT_LANGUAGES,
  SITE_URL,
  donateContent,
  donatePath,
  type DonateLocale,
} from '@/lib/donate-i18n';
import DonateLanding from '../DonateLanding';

// Solo fr/pt son válidos (en vive en /donate). Cualquier otro → 404.
const SUB_LOCALES: DonateLocale[] = ['fr', 'pt'];

export const dynamicParams = false;

export function generateStaticParams() {
  return SUB_LOCALES.map((lang) => ({ lang }));
}

const OG_LOCALE: Record<string, string> = { fr: 'fr_FR', pt: 'pt_BR' };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!SUB_LOCALES.includes(lang as DonateLocale)) return {};
  const t = donateContent[lang as DonateLocale];
  return {
    title: { absolute: t.meta.title },
    description: t.meta.description,
    alternates: {
      canonical: `${SITE_URL}${donatePath(lang as DonateLocale)}`,
      languages: ALT_LANGUAGES,
    },
    openGraph: {
      type: 'website',
      locale: OG_LOCALE[lang] || 'en_US',
      url: `${SITE_URL}${donatePath(lang as DonateLocale)}`,
      siteName: 'AcopioVE',
      title: t.meta.title,
      description: t.meta.description,
      images: [{ url: '/og-image-v2.png', width: 1200, height: 630, alt: 'AcopioVE' }],
    },
  };
}

export default async function DonateLangPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!SUB_LOCALES.includes(lang as DonateLocale)) notFound();
  return <DonateLanding locale={lang as DonateLocale} />;
}
