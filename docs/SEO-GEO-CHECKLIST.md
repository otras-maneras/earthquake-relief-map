# Checklist de SEO + GEO (para reutilizar en proyectos)

Guía práctica para implementar SEO tradicional **y** GEO (Generative Engine Optimization
= que te citen ChatGPT, Claude, Perplexity, Gemini, Google AI Overviews). Ordenado por
prioridad/impacto. Pensado para apps Next.js, pero la mayoría aplica a cualquier stack.

> Regla mental: **SEO** = aparecer en resultados de búsqueda. **GEO** = que la IA te
> entienda, te confíe y te **cite como fuente**. Hoy hay que hacer las dos.

---

## 1. Fundamentos técnicos (sin esto, nada indexa)
- [ ] **HTTPS** en todo el sitio, sin contenido mixto.
- [ ] **URLs limpias y estables** (slugs legibles, sin parámetros innecesarios).
- [ ] **Una URL canónica por contenido** → `<link rel="canonical">` (en Next: `alternates.canonical`).
- [ ] **`robots.txt`** que permita el sitio y bloquee solo lo privado (`/admin`, `/api`).
- [ ] **`sitemap.xml`** generado y declarado en robots.txt; enviado a Google Search Console y Bing.
- [ ] **Render del contenido sin requerir JS** para el bot (SSR/SSG). Si es SPA pura, los bots ven poco.
- [ ] **Estado HTTP correcto**: 200 para ok, 301 para redirects, 404 real para inexistentes (no “soft 404”).
- [ ] **Mobile-first**: responsive real, viewport meta, nada cortado en móvil.

## 2. Metadata / On-page (por página, no global)
- [ ] **`<title>` único** por página (~50-60 car.), con la keyword principal adelante.
- [ ] **`meta description`** única (~150-160 car.), descriptiva y con llamada a la acción.
- [ ] **Un solo `<h1>`** por página, jerarquía `h2/h3` coherente.
- [ ] **Open Graph** (`og:title`, `og:description`, `og:image` 1200×630, `og:url`, `og:type`).
- [ ] **Twitter Card** (`summary_large_image`).
- [ ] **`lang`** correcto en `<html>` (ej. `es-VE`).
- [ ] **Imágenes**: `alt` descriptivo, formatos modernos (webp/avif), `width/height`, `loading="lazy"` (menos el LCP).
- [ ] En Next: usar `generateMetadata` por ruta dinámica (no metadata estática global para todo).

## 3. Datos estructurados (schema.org / JSON-LD) — clave para SEO **y** GEO
- [ ] **JSON-LD** (no microdata) en `<script type="application/ld+json">`.
- [ ] Usar un **`@graph`** con varias entidades enlazadas por `@id`:
  - [ ] **`Organization`** (name, url, `logo`, `sameAs` [redes], `areaServed`, `description`).
  - [ ] **`WebSite`** (name, url, `publisher` → Organization, `inLanguage`; `SearchAction` **solo si hay buscador real** con URL `?q=`).
  - [ ] La entidad del producto/app: `WebApplication` / `SoftwareApplication` / `Product` según el caso.
- [ ] **`BreadcrumbList`** en páginas internas (mejora sitelinks).
- [ ] **`FAQPage`** si hay FAQs reales en la página (rich result + muy citable por IA).
- [ ] **`Article`/`BlogPosting`** en el blog (author, datePublished, dateModified, image, publisher).
- [ ] Entidades de dominio cuando apliquen: `Place`, `LocalBusiness`, `CivicStructure`, `Event`, `Organization (NGO)`…
- [ ] **Validar** con [Rich Results Test](https://search.google.com/test/rich-results) y [Schema validator](https://validator.schema.org/).
- [ ] El JSON-LD debe **reflejar lo visible** en la página (no inventar datos → penaliza).

## 4. GEO — optimización para motores de IA
- [ ] **`llms.txt`** en la raíz (`/llms.txt`): resumen del sitio + links a las páginas clave con descripción. Es el “mapa para LLMs”.
  - [ ] (Opcional) `llms-full.txt` con el contenido completo en markdown.
- [ ] **Permitir crawlers de IA** en robots.txt explícitamente: `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `ClaudeBot`, `anthropic-ai`, `PerplexityBot`, `Google-Extended`, `Applebot-Extended`, `CCBot`, `Amazonbot`.
- [ ] **Citabilidad**: respuestas directas y autocontenidas, párrafos cortos, datos concretos (cifras, fechas, definiciones), encabezados en forma de pregunta.
- [ ] **Frescura**: fechas de actualización visibles (`dateModified`), contenido vigente.
- [ ] **Autoridad / E-E-A-T**: autor identificable, fuentes citadas, “acerca de”, contacto. La IA pondera **menciones de marca** más que backlinks.
- [ ] **Contenido en texto plano accesible** (no encerrado solo en imágenes/canvas/JS).
- [ ] **Datos abiertos / API** si aplica: facilita que terceros (y la IA) te citen como fuente primaria. Atribución clara.
- [ ] Verificar de verdad: preguntar a ChatGPT/Perplexity por tu tema y ver si **te citan**.

## 5. Performance / Core Web Vitals (factor de ranking)
- [ ] **LCP < 2,5 s**: preload del recurso hero/LCP, fuentes con `font-display: swap`, imágenes optimizadas.
- [ ] **CLS < 0,1**: reservar tamaño de imágenes/embeds, evitar saltos de layout.
- [ ] **INP < 200 ms**: JS diferido, evitar bloqueos del hilo principal.
- [ ] **Preconnect/preload** a orígenes críticos (CDN de tiles, fuentes, analytics).
- [ ] Cache/CDN con buenos headers (`s-maxage`, `stale-while-revalidate`).
- [ ] Medir con PageSpeed Insights / Lighthouse / CrUX.

## 6. Indexación y rastreo
- [ ] Dar de alta en **Google Search Console** y **Bing Webmaster Tools**; verificar dominio.
- [ ] Revisar **cobertura**: páginas indexadas vs excluidas; arreglar errores.
- [ ] `noindex` solo en lo que no debe aparecer (login, gracias, duplicados).
- [ ] Evitar **contenido duplicado** (canonical, parámetros, www/no-www, trailing slash consistente).
- [ ] Enlazado interno: que toda página importante sea alcanzable en pocos clics.

## 7. Contenido
- [ ] Una **intención de búsqueda clara** por página (informacional / transaccional / navegacional).
- [ ] Keyword principal + variantes/sinónimos naturales (no keyword stuffing).
- [ ] Contenido **único y útil**, mejor que el de la competencia para esa query.
- [ ] Blog/recursos para keywords long-tail y para alimentar a la IA con contexto.

## 8. Internacionalización (si hay varios idiomas)
- [ ] **`hreflang`** entre versiones de idioma + `x-default`.
- [ ] URLs separadas por idioma (`/en`, `/es`…), no solo cambio por cookie.
- [ ] `lang` y metadata traducidos por versión.

## 9. Medición
- [ ] Analítica (GA4 / Umami / Plausible) — incluir **tráfico referido por IA** (chatgpt.com, perplexity.ai…).
- [ ] Search Console: consultas, CTR, posición; iterar sobre las que tienen impresiones y bajo CTR.
- [ ] Monitorear menciones de marca y citas en respuestas de IA.

---

## Checklist mínimo de arranque (orden de implementación)
1. SSR/SSG + título/description únicos por página + canonical.
2. OG/Twitter + imágenes con alt.
3. `robots.txt` (incluye bots de IA) + `sitemap.xml` + alta en Search Console.
4. JSON-LD `@graph`: Organization + WebSite + entidad principal; FAQPage/Article donde aplique.
5. `llms.txt` con páginas clave.
6. Core Web Vitals (LCP/CLS/INP) en verde.
7. Verificar citabilidad real en ChatGPT/Perplexity e iterar.

## Herramientas útiles
- Validación schema: Rich Results Test, validator.schema.org
- Performance: PageSpeed Insights, Lighthouse, WebPageTest
- Indexación: Google Search Console, Bing Webmaster Tools
- GEO/citas: probar directamente en ChatGPT, Perplexity, Gemini, Google AI Overviews
- `llms.txt`: especificación en llmstxt.org

---
*Nota: el JSON-LD y el `llms.txt` deben describir lo que realmente hay en el sitio.
Inflar o inventar datos estructurados penaliza en buscadores y resta confianza en IA.*
