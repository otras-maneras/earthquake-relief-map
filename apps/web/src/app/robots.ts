import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  // Crawlers de IA permitidos explícitamente (GEO): queremos que ChatGPT, Claude,
  // Perplexity, Gemini y la búsqueda con IA puedan leer y citar el sitio.
  const aiBots = [
    'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-Web',
    'anthropic-ai', 'PerplexityBot', 'Perplexity-User', 'Google-Extended',
    'Applebot-Extended', 'CCBot', 'Amazonbot',
  ];
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] },
      // Mismos permisos para los bots de IA (todo menos admin/api).
      { userAgent: aiBots, allow: '/', disallow: ['/admin', '/api/'] },
    ],
    sitemap: 'https://acopiove.org/sitemap.xml',
    host: 'https://acopiove.org',
  };
}

// llms.txt está disponible en: https://acopiove.org/llms.txt
