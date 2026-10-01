import { LLMService } from "./llm.service";
import logger from "../utils/logger";
import { rssCache, summaryCache } from "../utils/cache";
import { stats } from "../utils/stats";

interface RssSource {
  id: string;
  name: string;
  url: string;
}

const RSS_FEEDS: Record<string, RssSource> = {
  elpais: {
    id: "elpais",
    name: "El País (América)",
    url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/america/portada",
  },
  rt: {
    id: "rt",
    name: "RT (Russia Today)",
    url: "https://actualidad.rt.com/feeds/all.rss",
  },
  aporrea: {
    id: "aporrea",
    name: "Aporrea",
    url: "http://feeds.feedburner.com/aporrea/noticias",
  },
  dw: {
    id: "dw",
    name: "DW (Deutsche Welle)",
    url: "https://rss.dw.com/xml/rss-es-all",
  },
  lanacion: {
    id: "lanacion",
    name: "La Nación",
    url: "https://www.lanacion.com.ar/arc/outboundfeeds/rss/?outputType=xml",
  },
  nytimes: {
    id: "nytimes",
    name: "New York Times (World)",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
  },
  caracaschronicles: {
    id: "caracaschronicles",
    name: "Caracas Chronicles",
    url: "https://caracaschronicles.com/feed",
  },
  eldiario: {
    id: "eldiario",
    name: "El Diario",
    url: "https://eldiario.com/feed/",
  },
  efectococuyo: {
    id: "efectococuyo",
    name: "Efecto Cocuyo",
    url: "https://efectococuyo.com/feed/",
  },
  elnacional: {
    id: "elnacional",
    name: "El Nacional",
    url: "https://www.elnacional.com/feed/",
  },
  bbcmundo: {
    id: "bbcmundo",
    name: "BBC Mundo",
    url: "https://feeds.bbci.co.uk/mundo/rss.xml",
  },
  reliefweb: {
    id: "reliefweb",
    name: "ReliefWeb (ONU)",
    url: "https://reliefweb.int/updates/rss.xml",
  },
  unocha: {
    id: "unocha",
    name: "UN OCHA (ONU)",
    url: "https://www.unocha.org/rss.xml",
  },
};

const EMERGENCY_KEYWORDS = [
  "sismo", "terremoto", "temblor", "réplica", "tsunami", "catástrofe",
  "tragedia", "derrumbe", "colapso", "refugio", "acopio", "albergue",
  "desaparecidos", "víctimas", "fallecidos", "heridos", "ayuda humanitaria",
  "damnificados", "evacuación", "emergencia", "rescate", "escombros",
  "magnitud", "epicentro",
];

const GEOGRAPHIC_KEYWORDS = [
  "venezuela", "caracas", "yaracuy", "la guaira", "vargas", "falcón", "falcon",
  "portuguesa", "valencia", "maracay", "san felipe", "yumare", "nirgua",
  "morón", "moron", "carabobo", "barquisimeto", "lara", "miranda",
  "catia la mar", "macuto", "maiquetía", "maiquetia", "tucacas", "puerto cabello",
];

export class NewsService {
  public static async generateSummary(
    activeSources: string[],
    accountId: string,
  ): Promise<string> {
    const sourcesToProcess = activeSources
      .map((s) => s.toLowerCase())
      .includes("all")
      ? Object.keys(RSS_FEEDS)
      : activeSources;

    const sourcesToFetch = sourcesToProcess.filter((id) => RSS_FEEDS[id]);
    if (sourcesToFetch.length === 0) {
      throw new Error(
        "Debes seleccionar al menos una fuente de noticias activa.",
      );
    }

    logger.info(
      `[NEWS_SUMMARY] Generando resumen para cuenta ${accountId} desde fuentes: ${sourcesToFetch.join(", ")}...`,
    );

    const fetchPromises = sourcesToFetch.map((id) =>
      this.fetchAndParseRss(RSS_FEEDS[id]!),
    );
    const results = await Promise.all(fetchPromises);
    const consolidatedNews = results.join("\n---\n");

    if (!consolidatedNews.trim()) {
      logger.info(
        `[CACHE_SUMMARY] No se encontraron noticias para fuentes: ${sourcesToFetch.join(", ")}`,
      );
      return "No se encontraron noticias relevantes sobre Venezuela en las fuentes seleccionadas.";
    }

    const summaryCacheKey = `summary:${sourcesToFetch.slice().sort().join(",")}`;
    const cachedSummary = summaryCache.get<string>(summaryCacheKey);
    if (cachedSummary) {
      logger.info(
        `[CACHE_SUMMARY] Resumen cacheado encontrado para: ${summaryCacheKey}`,
      );
      stats.trackSummaryCacheHit();
      return cachedSummary;
    }

    logger.info(
      `[CACHE_SUMMARY] No hay resumen en cache. Consultando Gemini...`,
    );

    const currentServerTime = new Date().toISOString();

    const systemPrompt = `
Eres un asistente editorial experto en síntesis informativa y redacción periodística para situaciones de emergencia sísmica y desastres naturales.
Tu objetivo es analizar el listado de noticias de prensa provistas y generar un **Resumen Informativo de la Emergencia en Venezuela** estructurado, veraz, profesional y en formato de notificaciones directas.

Reglas del resumen:
1. **Filtro Temático:** Concéntrate exclusivamente en el impacto de los sismos, las réplicas, los daños de infraestructura, la suspensión de servicios y la red de ayuda humanitaria o centros de acopio en Venezuela. Descarta cualquier noticia ajena al país o a la crisis, y excluye cobertura política o partidista que no esté directamente ligada a la emergencia humanitaria.
2. **Estructura:** Agrupa las noticias en secciones ordenadas utilizando títulos de nivel 2 (ej: ## Reporte Sísmico y Emergencias, ## Estado de Colegios y Servicios, ## Centros de Acopio y Logística de Ayuda).
3. **Hipervínculos Obligatorios (Fuentes):** Cada hecho resumido debe finalizar obligatoriamente enlazando a la URL original provista en la etiqueta [URL_ORIGINAL: ...] camuflada en el nombre del medio.
   * *Ejemplo de formato:* "Este es el hecho resumido. (_[[El País](https://ejemplo.com/noticia)]_)"
4. **Deduplicación:** Si múltiples medios reportan la misma réplica o el mismo centro de acopio, consolida la información en un solo párrafo fluido y cita todos los enlaces en el mismo paréntesis: "(_[[El País](url1) / [DW](url2)]_ )".
5. **Fecha de publicación (Obligatorio):** Cada viñeta debe comenzar con la fecha/hora original de la noticia fuente, tomada de la etiqueta [FECHA_PUBLICACION: ...].
   * Formato exacto al inicio de cada viñeta: "pub. DD/MM/AAAA HH:MM:" (fecha real de la fuente).
   * *Ejemplo:* "* pub. 01/07/2026 14:30: Un fuerte sismo de magnitud 7.5 causó daños estructurales en La Guaira. (_[[El País](url)]_)"
   * **NO escribas tiempos relativos** como "Hace X horas" ni "Hace poco": ese texto queda obsoleto apenas pasa el tiempo, sobre todo si el resumen se sirve desde caché (ver sección de Caché). Si el consumidor de esta API quiere mostrar tiempo relativo, debe calcularlo él mismo a partir de esta fecha fija en el momento de renderizar, no confiar en un valor congelado en el texto.
   * Si falta la fecha de publicación en la fuente, omite el prefijo y comienza directamente con el hecho.
6. **Sin Emojis:** Está estrictamente prohibido el uso de emojis, emoticonos o símbolos decorativos en cualquier parte del texto (títulos y viñetas). El boletín debe ser enteramente sobrio, limpio y profesional.
7. **Sin preámbulos ni saludos:** No escribas ningún tipo de saludo, introducción, preámbulo (ej: "Claro, aquí tienes el resumen..."), comentarios explicativos ni cierres. Comienza directamente con el primer título o la primera viñeta de forma inmediata. El resultado debe ser puramente de estructura Markdown directa y limpia.
`;

    const userMessage = `
Hora de referencia actual del servidor: ${currentServerTime}

A continuación se detallan las noticias filtradas hoy de las fuentes de prensa activas:

${consolidatedNews}

Por favor, genera el resumen consolidado de hoy siguiendo las reglas descritas.
`;

    stats.trackGeminiCall();
    const modelId = "google/gemini-2.5-flash";
    const aiRes = await LLMService.generateResponse(
      systemPrompt,
      [],
      userMessage,
      undefined,
      accountId,
      modelId,
    );

    const summary = aiRes.text || "No se pudo generar el resumen.";
    summaryCache.set(summaryCacheKey, summary);
    logger.info(
      `[CACHE_SUMMARY] Resumen guardado en cache con key: ${summaryCacheKey}`,
    );

    return summary;
  }

  private static async fetchAndParseRss(source: RssSource): Promise<string> {
    const cacheKey = `rss:${source.id}`;
    const cached = rssCache.get<string>(cacheKey);
    if (cached) {
      logger.info(`[CACHE_RSS] Fuente "${source.name}" servida desde cache`);
      stats.trackRssCacheHit();
      return cached;
    }

    const result = await this.fetchRawRss(source);
    rssCache.set(cacheKey, result);
    logger.info(`[CACHE_RSS] Fuente "${source.name}" guardada en cache`);
    return result;
  }

  private static async fetchRawRss(source: RssSource): Promise<string> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(source.url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        return `### ${source.name}\nError: No se pudo conectar a la fuente (status ${res.status}).\n`;
      }

      const xml = await res.text();

      const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
      if (itemMatches.length === 0) {
        const entryMatches = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
        if (entryMatches.length === 0) {
          return `### ${source.name}\nNo se encontraron noticias recientes.\n`;
        }
        return this.parseEntries(source.name, entryMatches.slice(0, 15));
      }

      return this.parseItems(source.name, itemMatches.slice(0, 15));
    } catch (error: any) {
      return `### ${source.name}\nError al recuperar noticias: ${error.message}\n`;
    }
  }

  private static cleanHtmlAndCdata(text: string): string {
    if (!text) return "";
    let cleaned = text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
    cleaned = cleaned.replace(/<[^>]*>?/gm, "");
    return cleaned.replace(/\s+/g, " ").trim();
  }

  private static checkRelevance(title: string, desc: string): boolean {
    const text = `${title} ${desc}`.toLowerCase();
    if (text.includes("venezuela")) return true;
    const hasEmergency = EMERGENCY_KEYWORDS.some(kw => text.includes(kw));
    const hasGeographic = GEOGRAPHIC_KEYWORDS.some(kw => text.includes(kw));
    return hasEmergency && hasGeographic;
  }

  private static parseItems(sourceName: string, items: string[]): string {
    let output = `### ${sourceName}\n`;
    let newsFound = 0;

    items.forEach((item) => {
      const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);
      const descMatch = item.match(/<description>([\s\S]*?)<\/description>/);
      const pubDateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);

      const title = this.cleanHtmlAndCdata(titleMatch?.[1] ?? "Sin título");
      const link = linkMatch?.[1]?.trim() ?? "";
      const desc = this.cleanHtmlAndCdata(descMatch?.[1] ?? "").slice(0, 150);
      const pubDate = pubDateMatch?.[1] ? this.cleanHtmlAndCdata(pubDateMatch[1]) : "";

      if (!this.checkRelevance(title, desc)) return;

      newsFound++;
      output += `- **${title}**\n`;
      if (desc) output += `  _${desc}_\n`;
      if (pubDate) output += `  [FECHA_PUBLICACION: ${pubDate}]\n`;
      if (link) output += `  [URL_ORIGINAL: ${link}]\n`;
      output += "\n";
    });

    return newsFound > 0 ? output : "";
  }

  private static parseEntries(sourceName: string, entries: string[]): string {
    let output = `### ${sourceName}\n`;
    let newsFound = 0;

    entries.forEach((entry) => {
      const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch =
        entry.match(/<link[^>]+href=["']([^"']+)["']/i) ||
        entry.match(/<link>([\s\S]*?)<\/link>/);
      const summaryMatch =
        entry.match(/<summary>([\s\S]*?)<\/summary>/) ||
        entry.match(/<content>([\s\S]*?)<\/content>/);
      const updatedMatch =
        entry.match(/<updated>([\s\S]*?)<\/updated>/) ||
        entry.match(/<published>([\s\S]*?)<\/published>/);

      const title = this.cleanHtmlAndCdata(titleMatch?.[1] ?? "Sin título");
      const link = linkMatch?.[1]?.trim() ?? "";
      const desc = this.cleanHtmlAndCdata(summaryMatch?.[1] ?? "").slice(0, 150);
      const pubDate = updatedMatch?.[1] ? this.cleanHtmlAndCdata(updatedMatch[1]) : "";

      if (!this.checkRelevance(title, desc)) return;

      newsFound++;
      output += `- **${title}**\n`;
      if (desc) output += `  _${desc}_\n`;
      if (pubDate) output += `  [FECHA_PUBLICACION: ${pubDate}]\n`;
      if (link) output += `  [URL_ORIGINAL: ${link}]\n`;
      output += "\n";
    });

    return newsFound > 0 ? output : "";
  }
}
