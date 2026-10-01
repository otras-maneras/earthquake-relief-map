// Rate-limit en memoria (un solo proceso Next.js). Sin Redis: alcanza para esta app.
// Se resetea al reiniciar el servicio (aceptable para mitigar fuerza bruta / spam).

type Entry = { count: number; firstAt: number; blockedUntil: number };

const g = globalThis as unknown as { __rl?: Map<string, Entry> };
const store = g.__rl ?? (g.__rl = new Map<string, Entry>());

function sweep(now: number) {
  if (store.size < 5000) return;
  for (const [k, e] of store) if (e.blockedUntil < now && now - e.firstAt > 3_600_000) store.delete(k);
}

/** Segundos restantes de bloqueo, o 0 si no está bloqueado. */
export function blockedFor(key: string): number {
  const e = store.get(key);
  if (e && e.blockedUntil > Date.now()) return Math.ceil((e.blockedUntil - Date.now()) / 1000);
  return 0;
}

/** Registra un evento (intento fallido / request). Bloquea al superar `max` dentro de `windowMs`. */
export function hit(key: string, max: number, windowMs: number, blockMs: number): number {
  const now = Date.now();
  sweep(now);
  let e = store.get(key);
  if (!e || now - e.firstAt > windowMs) e = { count: 0, firstAt: now, blockedUntil: 0 };
  e.count++;
  if (e.count >= max) e.blockedUntil = now + blockMs;
  store.set(key, e);
  return e.blockedUntil > now ? Math.ceil((e.blockedUntil - now) / 1000) : 0;
}

export function reset(key: string) {
  store.delete(key);
}

/**
 * IP del cliente detrás del CDN (Cloudflare).
 *
 * SUPUESTO DE SEGURIDAD: estas cabeceras son falsificables por el cliente. Solo son
 * confiables si el origen es alcanzable ÚNICAMENTE a través del CDN (firewall que
 * restringe el puerto de la app a las IPs de Cloudflare). Si el origin queda expuesto
 * directamente, un atacante puede fijar CF-Connecting-IP/X-Forwarded-For a voluntad y
 * evadir el rate-limit y la protección de fuerza bruta del login. Ver docs/SEGURIDAD.md #5.
 */
export function clientIp(req: Request): string {
  // Detrás de Cloudflare (proxied), el IP real del cliente viene en CF-Connecting-IP.
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const xff = req.headers.get('x-forwarded-for') || '';
  return xff.split(',')[0].trim() || 'unknown';
}
