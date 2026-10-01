import Link from 'next/link';
import { ArrowRight, MapPin, Globe, MessageCircle, PhoneCall } from 'lucide-react';
import { SiteHeader, SiteFooter, Eyebrow, BRAND_PALETTE, type NavItem } from '@/components/site/Chrome';
import { getVoluntarios, cleanPhone, type Volunteer } from '@/lib/voluntarios';
import {
  INTERPRETES_LOCALES,
  SITE_URL,
  interpretesContent,
  interpretesPath,
  ALT_LANGUAGES,
  type InterpretesLocale,
} from '@/lib/interpretes-i18n';

const SAMPLE_SIZE = 9;

function LangSwitcher({ locale }: { locale: InterpretesLocale }) {
  return (
    <nav aria-label="Language" className="flex items-center gap-1">
      {INTERPRETES_LOCALES.map((l) => (
        <Link
          key={l}
          href={interpretesPath(l)}
          hrefLang={l}
          className={`text-[12px] font-bold px-2 py-1 rounded-md transition-colors ${
            l === locale ? 'text-ap-primary' : 'text-ap-muted hover:text-ap-primary'
          }`}
        >
          {l.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
}

function VolunteerCard({ v, t }: { v: Volunteer; t: ReturnType<typeof tFor> }) {
  const phone = cleanPhone(v.phone);
  const hasWhatsApp = !!v.contact_channels?.includes('WhatsApp');
  return (
    <div className="border border-ap-border rounded-xl p-4 bg-ap-surface flex flex-col gap-3">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[15px] font-bold text-ap-primary font-outfit leading-tight">{v.full_name}</h3>
          {v.fluency && (
            <span className="shrink-0 text-[10px] font-bold text-ap-muted bg-ap-bg border border-ap-border px-2 py-0.5 rounded-full">
              {v.fluency}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1 mt-2">
          {(v.languages || []).map((l) => (
            <span key={l} className="text-[10px] font-semibold px-2 py-0.5 rounded bg-ap-bg border border-ap-border text-ap-secondary">
              {l}
            </span>
          ))}
          {v.technical_knowledge && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-ap-bg border border-ap-border text-ap-secondary">
              {t.card.technical}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-2 text-[11px] text-ap-muted">
          <span className="inline-flex items-center gap-1">
            <MapPin size={11} />
            {v.city || v.state ? `${v.city || ''}${v.city && v.state ? ', ' : ''}${v.state || ''}` : t.card.remote}
          </span>
          {!v.in_venezuela && (
            <span className="inline-flex items-center gap-1">
              <Globe size={11} /> {t.card.outsideVe}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-auto pt-1">
        {hasWhatsApp && phone && (
          <a
            href={`https://wa.me/${phone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-ap-primary hover:bg-ap-secondary text-white font-bold text-[12px] py-2 rounded-lg transition-colors"
          >
            <MessageCircle size={13} /> {t.card.whatsapp}
          </a>
        )}
        {phone && (
          <a
            href={`tel:${phone}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 border border-ap-border hover:border-ap-muted text-ap-primary font-bold text-[12px] py-2 rounded-lg transition-colors"
          >
            <PhoneCall size={13} /> {t.card.call}
          </a>
        )}
      </div>
    </div>
  );
}

function tFor(locale: InterpretesLocale) {
  return interpretesContent[locale];
}

export default async function InterpretesLanding({ locale }: { locale: InterpretesLocale }) {
  const t = interpretesContent[locale];
  const url = `${SITE_URL}${interpretesPath(locale)}`;

  const { volunteers, stale } = await getVoluntarios();

  const total = volunteers.length;
  const languages = new Set(volunteers.flatMap((v) => v.languages || []).filter(Boolean)).size;
  const remote = volunteers.filter(
    (v) => (v.support_types || []).some((s) => /remot|online/i.test(s)) || (!v.city && !v.state)
  ).length;
  const sample = volunteers.slice(0, SAMPLE_SIZE);

  const stats = [
    { value: total, label: t.statsLabels.interpreters },
    { value: languages, label: t.statsLabels.languages },
    { value: remote, label: t.statsLabels.remote },
  ];

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

  const footerNav: NavItem[] = [
    { label: 'AcopioVE', href: '/' },
    { label: 'Blog', href: '/blog' },
  ];

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
            <a href="#lista" className="bg-ap-primary hover:bg-ap-secondary text-white font-bold text-[14px] px-6 py-3 rounded-lg transition-colors text-center">
              {t.ctaPrimary}
            </a>
            <a href={t.ctaSecondary.mailto} className="inline-flex items-center justify-center gap-1.5 text-ap-primary font-bold text-[14px] px-6 py-3 rounded-lg border border-ap-border hover:border-ap-muted transition-colors text-center">
              {t.ctaSecondary.label} <ArrowRight size={15} />
            </a>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-x-10 gap-y-4 mt-10">
            {stats.map((s, i) => (
              <div key={i} className="border-l-2 border-ap-primary/30 pl-3">
                <div className="text-[24px] md:text-[28px] font-extrabold text-ap-primary font-outfit leading-none tabular-nums">{s.value}</div>
                <div className="text-[12px] text-ap-muted font-semibold mt-1.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="max-w-[1000px] mx-auto px-4 py-14">
        <h2 className="text-[22px] md:text-[26px] font-extrabold text-ap-primary font-outfit">{t.howTitle}</h2>
        <ol className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-x-8 border-t border-ap-border">
          {t.steps.map((s, i) => (
            <li key={i} className="py-5 border-b border-ap-border sm:border-b-0">
              <span className="text-[14px] font-extrabold text-ap-muted font-outfit tabular-nums">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="text-[15px] font-bold text-ap-primary font-outfit mt-1.5">{s.title}</h3>
              <p className="text-[13px] text-ap-secondary mt-1 leading-relaxed">{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Lista */}
      <section id="lista" className="border-y border-ap-border bg-ap-surface scroll-mt-16">
        <div className="max-w-[1000px] mx-auto px-4 py-14">
          <h2 className="text-[22px] md:text-[26px] font-extrabold text-ap-primary font-outfit">{t.listTitle}</h2>
          <p className="text-[15px] text-ap-secondary mt-3 max-w-2xl leading-relaxed">{t.listIntro}</p>
          {stale && <p className="text-[12px] text-ap-muted mt-2">{t.staleNote}</p>}

          {sample.length === 0 ? (
            <p className="text-[14px] text-ap-muted mt-8">{t.emptyNote}</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-8">
                {sample.map((v) => (
                  <VolunteerCard key={v.id} v={v} t={t} />
                ))}
              </div>
              <p className="text-[12px] text-ap-muted mt-4">{t.sampleNote}</p>
              <Link href="/?modal=voluntarios" className="inline-flex items-center gap-1.5 text-[14px] font-bold text-ap-primary hover:underline mt-3">
                {t.viewAll} <ArrowRight size={15} />
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Sumate */}
      <section className="max-w-[1000px] mx-auto px-4 py-14">
        <div className="max-w-2xl">
          <h2 className="text-[22px] md:text-[26px] font-extrabold text-ap-primary font-outfit">{t.joinTitle}</h2>
          <p className="text-[15px] text-ap-secondary mt-3 leading-relaxed">{t.joinBody}</p>
          <a href={t.ctaSecondary.mailto} className="inline-flex items-center gap-1.5 bg-ap-primary hover:bg-ap-secondary text-white font-bold text-[14px] px-6 py-3 rounded-lg transition-colors mt-6">
            {t.joinCta} <ArrowRight size={15} />
          </a>
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

      <SiteFooter nav={footerNav} note={t.footerNote} />
    </main>
  );
}

export { ALT_LANGUAGES };
