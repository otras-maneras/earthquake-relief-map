/** Utilidades de fecha para el boletín de noticias (cliente y servidor). */

const VENEZUELA_TZ = 'America/Caracas';

/** Parsea "DD/MM/AAAA HH:MM" como hora de Venezuela. */
export function parsePubDateVenezuela(str: string): Date | null {
  const m = str.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const day = m[1]!.padStart(2, '0');
  const month = m[2]!.padStart(2, '0');
  const year = m[3]!;
  const hour = m[4]!.padStart(2, '0');
  const minute = m[5]!;
  const iso = `${year}-${month}-${day}T${hour}:${minute}:00-04:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Fecha absoluta legible en zona Venezuela. */
export function formatPubDateDisplay(date: Date): string {
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: VENEZUELA_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** Tiempo relativo calculado en el momento de lectura (no congelado en el texto). */
export function formatRelativeFromNow(date: Date, now = Date.now()): string {
  const diffMs = now - date.getTime();
  if (diffMs < 0) return 'Reciente';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Hace un momento';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Hace ${days} día${days > 1 ? 's' : ''}`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `Hace ${weeks} sem`;
  return formatPubDateDisplay(date);
}

/** Quita prefijos "Hace …" obsoletos del texto generado por el modelo. */
export function stripStaleRelativePrefix(text: string): string {
  return text
    .replace(/^Hace\s+[^·]+·\s*/i, '')
    .replace(/^Hace\s+(poco|\d+\s+\w+)\s*:\s*/i, '')
    .trim();
}

/**
 * Limpia un boletín Markdown completo: cada viñeta debe empezar con `pub. DD/MM/AAAA HH:MM:`
 * (el tiempo relativo lo calcula la UI al renderizar, no el texto almacenado).
 */
export function sanitizeSummaryMarkdown(summary: string): string {
  return summary
    .split('\n')
    .map((line) => {
      const m = line.match(/^(\s*[\*\-]\s*)(.*)$/);
      if (!m) return line;
      const prefix = m[1]!;
      let body = m[2]!;
      // "Hace 5 horas · pub. 02/07/..." → "pub. 02/07/..."
      body = body.replace(/^Hace\s+[^·]+·\s*(?=pub\.\s)/i, '');
      body = body.replace(/^Hace\s+(poco|\d+\s+[\wáéíóúñ]+)\s*·\s*(?=pub\.\s)/i, '');
      // "Hace 17 min: texto" o "Hace poco: texto" sin pub.
      body = body.replace(/^Hace\s+(?:poco|\d+\s*[\wáéíóúñ]*)\s*:\s*/i, '');
      body = body.replace(/^Hace\s+[^:·]+:\s*/i, '');
      return prefix + body.trimStart();
    })
    .join('\n');
}
