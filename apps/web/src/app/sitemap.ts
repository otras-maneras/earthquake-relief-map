import type { MetadataRoute } from 'next';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { centros } from '@/db/schema';
import { slugify } from '@/lib/centros';
import { blogPosts } from '@/lib/blog';

export const revalidate = 300; // actualiza el sitemap cada 5 minutos

// Agrupa país→ciudades (slugs únicos) a partir de filas con pais/ciudad.
function groupLocations(rows: { pais: string | null; ciudad: string | null }[]) {
  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.pais) continue;
    const pSlug = slugify(r.pais);
    if (!map.has(pSlug)) map.set(pSlug, new Set<string>());
    if (r.ciudad) map.get(pSlug)!.add(slugify(r.ciudad));
  }
  return map;
}

// Genera URLs base + por país + por ciudad para un prefijo de ruta (/centros, /refugios).
function locationUrls(base: string, locations: Map<string, Set<string>>): MetadataRoute.Sitemap {
  const out: MetadataRoute.Sitemap = [];
  for (const [pSlug, ciudades] of locations.entries()) {
    out.push({ url: `${base}/${pSlug}`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 });
    for (const cSlug of ciudades) {
      out.push({ url: `${base}/${pSlug}/${cSlug}`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.6 });
    }
  }
  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const allRows = await db
    .select({ pais: centros.pais, ciudad: centros.ciudad })
    .from(centros)
    .where(eq(centros.active, true));

  const refugioRows = await db
    .select({ pais: centros.pais, ciudad: centros.ciudad })
    .from(centros)
    .where(and(eq(centros.active, true), eq(centros.tipo, 'refugio')));

  const urls: MetadataRoute.Sitemap = [
    { url: 'https://acopiove.org', lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: 'https://acopiove.org/resumen', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: 'https://acopiove.org/docs', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.85 },
    { url: 'https://acopiove.org/docs/api', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.85 },
    { url: 'https://acopiove.org/data', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: 'https://acopiove.org/centros', lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: 'https://acopiove.org/refugios', lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    // Landing de voluntarios intérpretes (ES principal + EN) con alternates hreflang.
    {
      url: 'https://acopiove.org/interpretes',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
      alternates: {
        languages: {
          es: 'https://acopiove.org/interpretes',
          en: 'https://acopiove.org/interpretes/en',
        },
      },
    },
    { url: 'https://acopiove.org/interpretes/en', lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    { url: 'https://acopiove.org/acerca', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: 'https://acopiove.org/docs', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: 'https://acopiove.org/docs/api', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: 'https://acopiove.org/docs/fuentes', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    // Landing internacional de donaciones (multiidioma) con alternates hreflang.
    {
      url: 'https://acopiove.org/donate',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
      alternates: {
        languages: {
          en: 'https://acopiove.org/donate',
          fr: 'https://acopiove.org/donate/fr',
          pt: 'https://acopiove.org/donate/pt',
          es: 'https://acopiove.org/',
        },
      },
    },
    { url: 'https://acopiove.org/donate/fr', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: 'https://acopiove.org/donate/pt', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    // Blog informativo (español)
    { url: 'https://acopiove.org/blog', lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    ...blogPosts.map((p) => ({
      url: `https://acopiove.org/blog/${p.slug}`,
      lastModified: new Date(p.updated || p.date),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];

  urls.push(...locationUrls('https://acopiove.org/centros', groupLocations(allRows)));
  urls.push(...locationUrls('https://acopiove.org/refugios', groupLocations(refugioRows)));

  return urls;
}
