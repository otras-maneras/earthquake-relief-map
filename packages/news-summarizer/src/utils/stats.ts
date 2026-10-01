import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

interface StatsData {
  totalRequests: number;
  geminiCalls: number;
  rssCacheHits: number;
  summaryCacheHits: number;
  requestsByEndpoint: Record<string, number>;
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
      // archivo corrupto, empezar de cero
    }
    return {
      totalRequests: 0,
      geminiCalls: 0,
      rssCacheHits: 0,
      summaryCacheHits: 0,
      requestsByEndpoint: {},
      since: new Date().toISOString(),
    };
  }

  private save(): void {
    try {
      writeFileSync(STATS_FILE, JSON.stringify(this.data, null, 2));
    } catch {
      // ignorar errores de escritura
    }
  }

  trackRequest(endpoint: string): void {
    this.data.totalRequests++;
    this.data.requestsByEndpoint[endpoint] =
      (this.data.requestsByEndpoint[endpoint] || 0) + 1;
    this.save();
  }

  trackGeminiCall(): void {
    this.data.geminiCalls++;
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
