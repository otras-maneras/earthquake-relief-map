import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { blogPosts, getPost, SITE_URL } from '@/lib/blog';
import { SiteHeader, SiteFooter, ES_NAV, BRAND_PALETTE } from '@/components/site/Chrome';
import BlogContent from '../BlogContent';

export const dynamicParams = false;

export function generateStaticParams() {
  return blogPosts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: 'Artículo no encontrado' };
  const url = `${SITE_URL}/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      locale: 'es_VE',
      url,
      siteName: 'AcopioVE',
      title: post.title,
      description: post.description,
      publishedTime: post.date,
      modifiedTime: post.updated || post.date,
      images: [{ url: '/og-image-v2.png', width: 1200, height: 630, alt: post.title }],
    },
  };
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const url = `${SITE_URL}/blog/${post.slug}`;

  const graph: object[] = [
    {
      '@type': 'NewsArticle',
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      dateModified: post.updated || post.date,
      inLanguage: 'es',
      mainEntityOfPage: url,
      image: [`${SITE_URL}/og-image-v2.png`],
      author: { '@type': 'Organization', name: 'AcopioVE', url: SITE_URL },
      publisher: { '@type': 'Organization', name: 'AcopioVE', url: SITE_URL },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
        { '@type': 'ListItem', position: 3, name: post.title, item: url },
      ],
    },
  ];
  if (post.faq && post.faq.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: post.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    });
  }
  const jsonLd = { '@context': 'https://schema.org', '@graph': graph };

  return (
    <main id="main-content" className="min-h-[100dvh] bg-ap-bg font-sans" style={BRAND_PALETTE}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader nav={ES_NAV} active="/blog" />

      <article className="max-w-[720px] mx-auto px-4 py-10">
        <nav className="flex items-center gap-1.5 text-[12px] font-semibold text-ap-muted mb-6">
          <Link href="/blog" className="hover:text-ap-primary transition-colors">Blog</Link>
          <span className="text-ap-secondary/30">/</span>
          <span className="text-ap-secondary">{post.category}</span>
        </nav>

        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-ap-muted">{post.category}</span>
        <h1 className="text-[32px] md:text-[44px] font-semibold text-ap-primary font-serif mt-2.5 leading-[1.08] tracking-[-0.01em]">
          {post.title}
        </h1>
        {post.subtitle && (
          <p className="text-[18px] md:text-[20px] text-ap-secondary mt-4 leading-[1.5] font-medium">
            {post.subtitle}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-ap-muted font-semibold mt-6 pt-4 border-t border-ap-border">
          {post.byline && <span className="text-ap-secondary">{post.byline}</span>}
          {post.location && <><span className="text-ap-border">·</span><span>{post.location}</span></>}
          <span className="text-ap-border">·</span>
          <span>{fmtDate(post.date)}</span>
          {post.updated && post.updated !== post.date && <><span className="text-ap-border">·</span><span>Act. {fmtDate(post.updated)}</span></>}
          <span className="text-ap-border">·</span>
          <span>{post.readingMins} min de lectura</span>
        </div>

        <div className="mt-9">
          <BlogContent blocks={post.blocks} />
        </div>

        {post.faq && post.faq.length > 0 && (
          <section className="mt-12 pt-7 border-t border-ap-border">
            <h2 className="text-[20px] font-extrabold text-ap-primary font-outfit">Preguntas frecuentes</h2>
            <div className="mt-4 divide-y divide-ap-border border-t border-b border-ap-border">
              {post.faq.map((f, i) => (
                <details key={i} className="group">
                  <summary className="cursor-pointer list-none py-4 flex justify-between items-center gap-3">
                    <span className="font-bold text-[14px] text-ap-primary leading-snug">{f.q}</span>
                    <span className="text-[18px] text-ap-muted font-light shrink-0 group-open:rotate-45 transition-transform">+</span>
                  </summary>
                  <p className="pb-4 -mt-1 text-[14px] text-ap-secondary leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {post.related.length > 0 && (
          <section className="mt-12 pt-7 border-t border-ap-border">
            <h2 className="text-[16px] font-extrabold text-ap-primary font-outfit">Seguir leyendo</h2>
            <ul className="mt-3 space-y-2.5">
              {post.related.map((r, i) => (
                <li key={i}>
                  <Link href={r.href} className="text-[14px] font-semibold text-ap-primary hover:underline inline-flex items-center gap-1.5">
                    <ArrowRight size={14} /> {r.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>

      <SiteFooter />
    </main>
  );
}
