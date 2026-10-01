import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { blogPosts, SITE_URL } from '@/lib/blog';
import { SiteHeader, SiteFooter, Eyebrow, ES_NAV, BRAND_PALETTE } from '@/components/site/Chrome';

export const metadata: Metadata = {
  title: 'Blog · Terremoto en Venezuela 2026: información, refugios y ayuda',
  description:
    'Artículos verificados sobre el terremoto de Venezuela 2026: qué pasó, refugios habilitados, guía de seguridad ante réplicas y cómo ayudar a los afectados.',
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    type: 'website',
    locale: 'es_VE',
    url: `${SITE_URL}/blog`,
    siteName: 'AcopioVE',
    title: 'Blog · Terremoto en Venezuela 2026',
    description: 'Información verificada sobre el terremoto, refugios, seguridad y cómo ayudar.',
    images: [{ url: '/og-image-v2.png', width: 1200, height: 630, alt: 'AcopioVE' }],
  },
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function BlogIndex() {
  const posts = [...blogPosts].sort((a, b) => (a.date < b.date ? 1 : -1));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Blog de AcopioVE',
    url: `${SITE_URL}/blog`,
    inLanguage: 'es',
    blogPost: posts.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      description: p.description,
      datePublished: p.date,
      dateModified: p.updated || p.date,
      url: `${SITE_URL}/blog/${p.slug}`,
    })),
  };

  return (
    <main id="main-content" className="min-h-[100dvh] bg-ap-bg font-sans" style={BRAND_PALETTE}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader nav={ES_NAV} active="/blog" />

      <section className="border-b border-ap-border">
        <div className="max-w-[1000px] mx-auto px-4 py-12 md:py-16">
          <Eyebrow>Información verificada</Eyebrow>
          <h1 className="text-[34px] md:text-[46px] font-semibold text-ap-primary font-serif leading-[1.04] mt-3 max-w-3xl tracking-[-0.01em]">
            Terremoto en Venezuela 2026: información y ayuda
          </h1>
          <p className="text-[17px] text-ap-secondary mt-4 max-w-2xl leading-relaxed">
            Artículos para entender qué pasó, dónde refugiarse, cómo protegerse ante las réplicas y cómo ayudar a los afectados.
          </p>
        </div>
      </section>

      <section className="max-w-[1000px] mx-auto px-4 py-10">
        {/* Nota principal (portada) */}
        {posts[0] && (
          <Link href={`/blog/${posts[0].slug}`} className="group block border-b border-ap-border pb-9 mb-9">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ap-muted">{posts[0].category}</span>
            <h2 className="text-[27px] md:text-[34px] font-semibold text-ap-primary font-serif leading-[1.12] mt-2 max-w-3xl tracking-[-0.01em] group-hover:text-ap-secondary transition-colors">
              {posts[0].title}
            </h2>
            <p className="text-[15.5px] text-ap-secondary mt-3 leading-relaxed max-w-2xl">{posts[0].subtitle || posts[0].excerpt}</p>
            <div className="text-[12px] text-ap-muted font-semibold mt-3">{fmtDate(posts[0].date)} · {posts[0].readingMins} min de lectura</div>
          </Link>
        )}

        {/* Resto de artículos */}
        <div className="border-t border-ap-border divide-y divide-ap-border">
          {posts.slice(1).map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="group block py-6 md:flex md:items-baseline md:gap-8 hover:bg-ap-surface-hover transition-colors -mx-3 px-3 rounded-lg">
              <div className="md:w-40 shrink-0 mb-2 md:mb-0">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ap-muted">{p.category}</span>
                <div className="text-[12px] text-ap-muted mt-1">{fmtDate(p.date)} · {p.readingMins} min</div>
              </div>
              <div className="flex-1">
                <h2 className="text-[20px] md:text-[23px] font-semibold text-ap-primary font-serif leading-[1.2] group-hover:text-ap-secondary transition-colors">
                  {p.title}
                </h2>
                <p className="text-[14px] text-ap-secondary mt-2 leading-relaxed max-w-2xl">{p.excerpt}</p>
                <span className="text-[13px] font-bold text-ap-primary mt-3 inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                  Leer <ArrowRight size={14} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
