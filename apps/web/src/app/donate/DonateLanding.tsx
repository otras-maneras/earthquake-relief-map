import Link from 'next/link';
import { MapPin, Home, Package, Globe, ArrowRight } from 'lucide-react';
import { SiteHeader, SiteFooter, Eyebrow, BRAND_PALETTE, type NavItem } from '@/components/site/Chrome';
import {
  DONATE_LOCALES,
  SITE_URL,
  donateContent,
  donatePath,
  type DonateLocale,
  type FeatureIcon,
} from '@/lib/donate-i18n';
import { donaciones } from '@/lib/donaciones';

const ICONS: Record<FeatureIcon, React.ComponentType<{ size?: number; className?: string }>> = {
  map: MapPin,
  shelter: Home,
  box: Package,
  phone: MapPin,
  globe: Globe,
};

function LangSwitcher({ locale }: { locale: DonateLocale }) {
  return (
    <nav aria-label="Language" className="flex items-center gap-1">
      {DONATE_LOCALES.map((l) => (
        <Link
          key={l}
          href={donatePath(l)}
          hrefLang={l}
          className={`text-[12px] font-bold px-2 py-1 rounded-md transition-colors ${
            l === locale ? 'text-ap-primary' : 'text-ap-muted hover:text-ap-primary'
          }`}
        >
          {l.toUpperCase()}
        </Link>
      ))}
      <Link href="/" hrefLang="es" className="text-[12px] font-bold px-2 py-1 rounded-md text-ap-muted hover:text-ap-primary transition-colors">ES</Link>
    </nav>
  );
}

export default function DonateLanding({ locale }: { locale: DonateLocale }) {
  const t = donateContent[locale];
  const url = `${SITE_URL}${donatePath(locale)}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': url,
        url,
        name: t.meta.title,
        description: t.meta.description,
        inLanguage: t.htmlLang,
        isPartOf: { '@type': 'WebSite', name: 'AcopioVE', url: SITE_URL },
        about: { '@type': 'Event', name: '2026 Venezuela earthquakes', startDate: '2026-06-24' },
      },
      {
        '@type': 'FAQPage',
        mainEntity: t.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'AcopioVE', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: t.title, item: url },
        ],
      },
    ],
  };

  const footerNav: NavItem[] = [{ label: t.ctaPrimary.label, href: '/' }, { label: 'Blog', href: '/blog' }];

  return (
    <main id="main-content" lang={t.htmlLang} className="min-h-[100dvh] bg-ap-bg font-sans" style={BRAND_PALETTE}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader nav={[]} right={<LangSwitcher locale={locale} />} />

      {/* Hero */}
      <section className="border-b border-ap-border">
        <div className="max-w-[1000px] mx-auto px-4 py-14 md:py-20">
          <Eyebrow>{t.badge}</Eyebrow>
          <h1 className="text-[32px] md:text-[46px] font-extrabold text-ap-primary font-outfit leading-[1.07] mt-3 max-w-3xl">
            {t.title}
          </h1>
          <p className="text-[16px] md:text-[18px] text-ap-secondary mt-5 max-w-2xl leading-relaxed">{t.subtitle}</p>
          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <Link href={t.ctaPrimary.href} className="bg-ap-primary hover:bg-ap-secondary text-white font-bold text-[14px] px-6 py-3 rounded-lg transition-colors text-center">
              {t.ctaPrimary.label}
            </Link>
            <Link href={t.ctaSecondary.href} className="inline-flex items-center justify-center gap-1.5 text-ap-primary font-bold text-[14px] px-6 py-3 rounded-lg border border-ap-border hover:border-ap-muted transition-colors text-center">
              {t.ctaSecondary.label} <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* Qué es + features */}
      <section className="max-w-[1000px] mx-auto px-4 py-14">
        <div className="max-w-2xl">
          <h2 className="text-[22px] md:text-[26px] font-extrabold text-ap-primary font-outfit">{t.whatTitle}</h2>
          <p className="text-[15px] text-ap-secondary mt-3 leading-relaxed">{t.whatBody}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 border border-ap-border rounded-xl divide-y sm:divide-y-0 divide-ap-border mt-8 overflow-hidden">
          {t.features.map((f, i) => {
            const Icon = ICONS[f.icon];
            return (
              <Link
                key={i}
                href={f.href}
                className={`group p-5 hover:bg-ap-surface-hover transition-colors ${i % 2 === 0 ? 'sm:border-r border-ap-border' : ''} ${i < t.features.length - 2 ? 'sm:border-b' : ''} border-ap-border`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon size={18} className="text-ap-primary" />
                  <h3 className="text-[15px] font-bold text-ap-primary font-outfit">{f.title}</h3>
                </div>
                <p className="text-[13px] text-ap-secondary mt-2 leading-relaxed">{f.desc}</p>
                <span className="text-[13px] font-bold text-ap-primary mt-3 inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                  {f.cta} <ArrowRight size={14} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Contexto + stats */}
      <section className="border-y border-ap-border bg-ap-surface">
        <div className="max-w-[1000px] mx-auto px-4 py-14">
          <div className="max-w-2xl">
            <h2 className="text-[20px] md:text-[24px] font-extrabold text-ap-primary font-outfit">{t.contextTitle}</h2>
            <p className="text-[15px] text-ap-secondary mt-3 leading-relaxed">{t.contextBody}</p>
          </div>
          <div className="flex flex-wrap gap-x-10 gap-y-4 mt-8">
            {t.stats.map((s, i) => (
              <div key={i} className="border-l-2 border-ap-primary/30 pl-3">
                <div className="text-[22px] md:text-[26px] font-extrabold text-ap-primary font-outfit leading-none">{s.value}</div>
                <div className="text-[12px] text-ap-muted font-semibold mt-1.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo ayudar */}
      <section className="max-w-[1000px] mx-auto px-4 py-14">
        <h2 className="text-[22px] md:text-[26px] font-extrabold text-ap-primary font-outfit">{t.waysTitle}</h2>
        <ol className="mt-6 divide-y divide-ap-border border-t border-b border-ap-border">
          {t.ways.map((w, i) => (
            <li key={i} className="py-5 flex gap-4">
              <span className="text-[14px] font-extrabold text-ap-muted font-outfit pt-0.5 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
              <div className="flex-1">
                <h3 className="text-[16px] font-bold text-ap-primary font-outfit">{w.title}</h3>
                <p className="text-[14px] text-ap-secondary mt-1 leading-relaxed">{w.desc}</p>
                <Link href={w.href} className="text-[13px] font-bold text-ap-primary hover:underline mt-2.5 inline-flex items-center gap-1">
                  {w.cta} <ArrowRight size={14} />
                </Link>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-[13px] text-ap-muted mt-5">{t.soon}</p>
      </section>

      {/* Canales verificados con logos */}
      <section className="border-t border-ap-border bg-ap-surface">
        <div className="max-w-[1000px] mx-auto px-4 py-14">
          <h2 className="text-[22px] md:text-[26px] font-extrabold text-ap-primary font-outfit">{t.channels.title}</h2>
          <p className="text-[14px] text-ap-secondary mt-2 max-w-2xl leading-relaxed">{t.channels.subtitle}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-8">
            {donaciones.map((d) => (
              <div key={d.name} className="border border-ap-border rounded-xl p-4 bg-ap-bg/40 flex flex-col">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.logo} alt={`${d.name}`} className="w-12 h-12 rounded-lg object-contain bg-white border border-ap-border p-1" loading="lazy" />
                  <span className="font-bold text-ap-primary text-[15px] font-outfit leading-tight">{d.name}</span>
                </div>
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center justify-center gap-1.5 bg-ap-primary hover:bg-ap-secondary text-white font-bold text-[13px] py-2.5 rounded-lg transition-colors"
                >
                  {t.channels.donate} <ArrowRight size={14} />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-ap-border bg-ap-surface">
        <div className="max-w-[760px] mx-auto px-4 py-14">
          <h2 className="text-[22px] md:text-[26px] font-extrabold text-ap-primary font-outfit">{t.faqTitle}</h2>
          <div className="mt-6 divide-y divide-ap-border border-t border-b border-ap-border">
            {t.faq.map((f, i) => (
              <details key={i} className="group">
                <summary className="cursor-pointer list-none py-4 flex justify-between items-center gap-3">
                  <span className="font-bold text-[14px] text-ap-primary leading-snug">{f.q}</span>
                  <span className="text-[18px] text-ap-muted font-light shrink-0 group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="pb-4 -mt-1 text-[14px] text-ap-secondary leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter nav={footerNav} note={t.transparency.body} />
    </main>
  );
}
