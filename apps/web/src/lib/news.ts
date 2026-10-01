import { existsSync, readFileSync, writeFileSync, statSync } from "fs";
import path from "path";
import { sanitizeSummaryMarkdown } from "@/lib/newsDates";

// Definición de fuentes RSS/Atom configuradas
export interface RssSource {
  id: string;
  name: string;
  url: string;
}

export const RSS_FEEDS: Record<string, RssSource> = {
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

// Doble filtro: al menos un término de emergencia AND un término geográfico (o "Venezuela")
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

// Implementación simple de caché en memoria para RSS (15 min)
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<any>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }
}

const cache = new MemoryCache();

// Tracker de estadísticas persistente en stats.json
interface StatsData {
  totalRequests: number;
  openrouterCalls: number;
  rssCacheHits: number;
  summaryCacheHits: number;
  since: string;
}

const STATS_FILE = path.resolve(process.cwd(), "stats.json");

class StatsTracker {
  private data: StatsData;

  constructor() {
    this.data = this.load();
  }

  private load(): StatsData {
    try {
      if (existsSync(STATS_FILE)) {
        const raw = readFileSync(STATS_FILE, "utf-8");
        return JSON.parse(raw);
      }
    } catch {
      // Ignorar
    }
    return {
      totalRequests: 0,
      openrouterCalls: 0,
      rssCacheHits: 0,
      summaryCacheHits: 0,
      since: new Date().toISOString(),
    };
  }

  private save(): void {
    try {
      writeFileSync(STATS_FILE, JSON.stringify(this.data, null, 2));
    } catch {
      // Ignorar
    }
  }

  trackRequest(): void {
    this.data.totalRequests++;
    this.save();
  }

  trackOpenRouterCall(): void {
    this.data.openrouterCalls++;
    this.save();
  }

  trackRssCacheHit(): void {
    this.data.rssCacheHits++;
    this.save();
  }

  trackSummaryCacheHit(): void {
    this.data.summaryCacheHits++;
    this.save();
  }

  getStats(): StatsData & { uptime: number } {
    return {
      ...this.data,
      uptime: Math.floor((Date.now() - new Date(this.data.since).getTime()) / 1000),
    };
  }
}

export const stats = new StatsTracker();

// Modelo para síntesis de noticias. Flash es ~30× más barato que 2.5 Pro y basta para resúmenes.
// Override con OPENROUTER_NEWS_MODEL en .env si hace falta.
const NEWS_MODEL = process.env.OPENROUTER_NEWS_MODEL || "google/gemini-2.5-flash";
const NEWS_MAX_TOKENS = Number(process.env.OPENROUTER_NEWS_MAX_TOKENS || 8192);

// Ciclo de actualización del boletín: la generación real solo la dispara el cron
// (ver NEWS_CRON_SECRET); este umbral define cuándo el propio cron considera "fresco"
// el caché y evita regenerar de más si se lo llama con más frecuencia de la programada.
const NEWS_REFRESH_MS = Number(process.env.NEWS_REFRESH_HOURS || 4) * 60 * 60 * 1000;

export interface NewsHistoryEntry {
  timestamp: string;
  summary: string;
}

export interface NewsSummaryResult {
  summary: string;
  history: NewsHistoryEntry[];
}

export class NewsService {
  /**
   * Devuelve el boletín en caché (disco) sin regenerar con IA. Para integradores.
   */
  public static async getCachedSummary(
    activeSources: string[],
  ): Promise<{ summary: string | null; cachedAt: string | null; history: NewsHistoryEntry[] }> {
    const sourcesToProcess = activeSources
      .map((s) => s.toLowerCase())
      .includes("all")
      ? Object.keys(RSS_FEEDS)
      : activeSources;
    const sourcesToFetch = sourcesToProcess.filter((id) => RSS_FEEDS[id]);
    if (sourcesToFetch.length === 0) {
      throw new Error("Debes seleccionar al menos una fuente de noticias activa.");
    }
    const sourcesSlug = sourcesToFetch.slice().sort().join("-");
    const cacheFile = path.resolve(process.cwd(), `news-summary-${sourcesSlug}.json`);
    let summary: string | null = null;
    let cachedAt: string | null = null;
    if (existsSync(cacheFile)) {
      try {
        const cachedData = JSON.parse(readFileSync(cacheFile, "utf-8"));
        const cleaned = sanitizeSummaryMarkdown(cachedData.summary || "");
        if (cleaned !== cachedData.summary) {
          writeFileSync(
            cacheFile,
            JSON.stringify({ ...cachedData, summary: cleaned }, null, 2),
          );
        }
        summary = cleaned;
        cachedAt = cachedData.timestamp || null;
      } catch {
        summary = null;
      }
    }
    const history = await this.getHistoryList();
    return { summary, cachedAt, history };
  }

  /**
   * Genera el boletín de prensa diario consolidado con caché persistente en disco (Stale-While-Revalidate)
   * y guarda el historial acumulado en news-history.json
   */
  public static async generateSummary(
    activeSources: string[],
    accountId: string
  ): Promise<NewsSummaryResult> {
    stats.trackRequest();

    const sourcesToProcess = activeSources
      .map((s) => s.toLowerCase())
      .includes("all")
      ? Object.keys(RSS_FEEDS)
      : activeSources;

    const sourcesToFetch = sourcesToProcess.filter((id) => RSS_FEEDS[id]);
    if (sourcesToFetch.length === 0) {
      throw new Error("Debes seleccionar al menos una fuente de noticias activa.");
    }

    const sourcesSlug = sourcesToFetch.slice().sort().join("-");
    const cacheFile = path.resolve(process.cwd(), `news-summary-${sourcesSlug}.json`);

    // Intentar leer la caché en disco
    if (existsSync(cacheFile)) {
      try {
        const statsObj = statSync(cacheFile);
        const fileAgeMs = Date.now() - statsObj.mtimeMs;
        const cachedData = JSON.parse(readFileSync(cacheFile, "utf-8"));

        // Si la caché sigue dentro del ciclo de actualización, se sirve de inmediato junto con el historial
        if (fileAgeMs < NEWS_REFRESH_MS) {
          stats.trackSummaryCacheHit();
          const history = await this.getHistoryList();
          return {
            summary: sanitizeSummaryMarkdown(cachedData.summary || ""),
            history,
          };
        }

        // Si la caché expiró, devolvemos el boletín antiguo de inmediato
        // para dar una experiencia de 0ms al usuario actual, y disparamos la regeneración
        // asíncrona de fondo para actualizar el archivo de cara al próximo visitante
        console.log(`[NEWS_SERVICE] Caché obsoleta (${Math.round(fileAgeMs / 1000 / 60)} min). Regenerando en segundo plano...`);
        
        this.updateCacheInBackground(sourcesToFetch, cacheFile).catch((err) => {
          console.error("[NEWS_SERVICE_BG] Falló regeneración en segundo plano:", err);
        });

        stats.trackSummaryCacheHit();
        const history = await this.getHistoryList();
        return {
          summary: sanitizeSummaryMarkdown(cachedData.summary || ""),
          history,
        };
      } catch (err) {
        console.error("[NEWS_SERVICE] Error de lectura de caché, procediendo de forma síncrona:", err);
      }
    }

    // Primer inicio absoluto: no hay archivo de caché en disco, compilamos síncronamente
    console.log(`[NEWS_SERVICE] Sin caché en disco. Compilando resumen de noticias síncronamente...`);
    const summary = await this.compileSummaryDirect(sourcesToFetch);

    try {
      writeFileSync(cacheFile, JSON.stringify({ summary, timestamp: new Date().toISOString() }));
    } catch (err) {
      console.error("[NEWS_SERVICE] Error al guardar caché en disco:", err);
    }

    const history = await this.updateHistory(summary);
    return { summary, history };
  }

  /**
   * Actualiza el archivo de caché persistente de fondo y el historial
   */
  private static async updateCacheInBackground(
    sourcesToFetch: string[],
    cacheFile: string
  ): Promise<void> {
    try {
      const summary = await this.compileSummaryDirect(sourcesToFetch);
      writeFileSync(cacheFile, JSON.stringify({ summary, timestamp: new Date().toISOString() }));
      await this.updateHistory(summary);
      console.log(`[NEWS_SERVICE] Caché e historial actualizados en segundo plano.`);
    } catch (err) {
      console.error("[NEWS_SERVICE] Error actualizando caché en segundo plano:", err);
    }
  }

  /**
   * Recupera la lista del historial acumulado
   */
  private static async getHistoryList(): Promise<NewsHistoryEntry[]> {
    const historyFile = path.resolve(process.cwd(), "news-history.json");
    if (!existsSync(historyFile)) return [];

    try {
      const raw: NewsHistoryEntry[] = JSON.parse(readFileSync(historyFile, "utf-8"));
      let changed = false;
      const cleaned = raw.map((entry) => {
        const summary = sanitizeSummaryMarkdown(entry.summary || "");
        if (summary !== entry.summary) changed = true;
        return { ...entry, summary };
      });
      if (changed) {
        writeFileSync(historyFile, JSON.stringify(cleaned, null, 2));
        console.log("[NEWS_SERVICE] Historial migrado: eliminados tiempos relativos obsoletos.");
      }
      return cleaned;
    } catch {
      return [];
    }
  }

  /**
   * Actualiza e inserta una nueva entrada de historial sin duplicarla
   */
  private static async updateHistory(summary: string): Promise<NewsHistoryEntry[]> {
    const historyFile = path.resolve(process.cwd(), "news-history.json");
    let history: NewsHistoryEntry[] = [];
    
    if (existsSync(historyFile)) {
      try {
        history = JSON.parse(readFileSync(historyFile, "utf-8"));
      } catch (err) {
        console.error("[NEWS_SERVICE] Error leyendo historial:", err);
      }
    }

    const cleanSummaryText = (s: string) => s.replace(/\s+/g, " ").trim();
    const lastEntry = history[0];
    
    if (!lastEntry || cleanSummaryText(lastEntry.summary) !== cleanSummaryText(summary)) {
      history.unshift({
        timestamp: new Date().toISOString(),
        summary: sanitizeSummaryMarkdown(summary),
      });
      history = history.slice(0, 30); // Limitar a los últimos 30 reportes
      try {
        writeFileSync(historyFile, JSON.stringify(history, null, 2));
        console.log(`[NEWS_SERVICE] Historial actualizado. Total reportes: ${history.length}`);
      } catch (err) {
        console.error("[NEWS_SERVICE] Error guardando historial:", err);
      }
    }

    return history;
  }

  /**
   * Realiza la llamada directa a OpenRouter y compila los feeds de noticias
   */
  private static async compileSummaryDirect(sourcesToFetch: string[]): Promise<string> {
    const fetchPromises = sourcesToFetch.map((id) => this.fetchAndParseRss(RSS_FEEDS[id]!));
    const results = await Promise.all(fetchPromises);
    const consolidatedNews = results.filter(r => r.trim()).join("\n---\n");

    if (!consolidatedNews.trim()) {
      return "No se encontraron noticias recientes y relevantes sobre la emergencia en las fuentes seleccionadas.";
    }

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
   * Formato exacto al inicio de cada viñeta: "pub. DD/MM/AAAA HH:MM:" (fecha real de la fuente, zona horaria Venezuela).
   * *Ejemplo:* "* pub. 01/07/2026 14:30: Un fuerte sismo de magnitud 7.5 causó daños estructurales en La Guaira. (_[[El País](url)]_)"
   * **NO escribas tiempos relativos** como "Hace X horas" ni "Hace poco" — el sistema los calcula al mostrar el boletín.
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

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey) {
      throw new Error("La variable de entorno OPENROUTER_API_KEY no está configurada.");
    }

    stats.trackOpenRouterCall();

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openrouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://acopiove.org",
        "X-Title": "AcopioVE News Summarizer",
      },
      body: JSON.stringify({
        model: NEWS_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        temperature: 0.5,
        max_tokens: NEWS_MAX_TOKENS,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[NEWS_SERVICE] Error en OpenRouter: Status ${response.status} - ${errText}`);
      throw new Error("No se pudo obtener la respuesta del modelo inteligente.");
    }

    const resJson = await response.json();
    const raw = resJson.choices?.[0]?.message?.content || "No se pudo generar el resumen.";
    return this.normalizeSummaryText(raw);
  }

  /** Elimina tiempos relativos congelados que el modelo aún pueda generar. */
  private static normalizeSummaryText(summary: string): string {
    return sanitizeSummaryMarkdown(summary);
  }

  private static async fetchAndParseRss(source: RssSource): Promise<string> {
    const cacheKey = `rss:${source.id}`;
    const cached = cache.get<string>(cacheKey);
    if (cached) {
      stats.trackRssCacheHit();
      return cached;
    }

    const result = await this.fetchRawRss(source);
    // Guardar feed en caché de memoria por 15 minutos (900000 ms)
    cache.set(cacheKey, result, 15 * 60 * 1000);
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

  /** Normaliza pubDate RSS a "DD/MM/AAAA HH:MM" (America/Caracas) para el prompt y la UI. */
  private static formatPubDate(pubDate: string): string {
    if (!pubDate) return "";
    const d = new Date(pubDate);
    if (Number.isNaN(d.getTime())) return pubDate.trim();
    const parts = new Intl.DateTimeFormat("es-VE", {
      timeZone: "America/Caracas",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
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
      const formattedDate = pubDate ? this.formatPubDate(pubDate) : "";
      if (formattedDate) output += `  [FECHA_PUBLICACION: ${formattedDate}]\n`;
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
      const formattedDate = pubDate ? this.formatPubDate(pubDate) : "";
      if (formattedDate) output += `  [FECHA_PUBLICACION: ${formattedDate}]\n`;
      if (link) output += `  [URL_ORIGINAL: ${link}]\n`;
      output += "\n";
    });

    return newsFound > 0 ? output : "";
  }
}
