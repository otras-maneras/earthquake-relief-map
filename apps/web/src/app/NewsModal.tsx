'use client';

import { useEffect, useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { formatRelativeFromNow, parsePubDateVenezuela, stripStaleRelativePrefix } from '@/lib/newsDates';

interface NewsHistoryEntry {
  timestamp: string;
  summary: string;
}

export default function NewsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [history, setHistory] = useState<NewsHistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Solo lee el boletín ya generado (caché en disco); la generación la dispara
  // un cron interno cada 4h, nunca el navegador (ver NEWS_CRON_SECRET).
  const fetchNews = () => {
    setLoading(true);
    setError(null);
    fetch('/api/news/summary?sources=all')
      .then((res) => res.json().then((data) => ({ status: res.status, data })))
      .then(({ status, data }) => {
        if (data.ok) {
          if (data.history && data.history.length > 0) {
            setHistory(data.history);
            setHistoryIndex(0);
          } else {
            setHistory([{ timestamp: data.cachedAt || new Date().toISOString(), summary: data.summary }]);
            setHistoryIndex(0);
          }
        } else if (status === 404) {
          setError('Todavía no hay un boletín generado. Volvé a intentar en unos minutos.');
        } else {
          setError(data.error || 'No se pudo obtener el boletín.');
        }
      })
      .catch(() => setError('Error de conexión al servidor de noticias.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open) return;
    fetchNews();
  }, [open]);

  if (!open) return null;

  // Limpiador preventivo de emojis para títulos y textos
  const cleanEmojis = (text: string): string => {
    if (!text) return '';
    return text.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim();
  };

  // Formateador de fechas del historial (ej: 29/06 06:00)
  const formatTimestamp = (isoStr: string) => {
    if (!isoStr) return '';
    try {
      const date = new Date(isoStr);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day}/${month} ${hours}:${minutes}`;
    } catch {
      return '';
    }
  };

  const parseInlineFormatting = (text: string): React.ReactNode[] => {
    let parts: { type: 'text' | 'bold' | 'link'; content: string; url?: string }[] = [{ type: 'text', content: text }];

    // 1. Enlaces Markdown [Texto](URL)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let newParts: typeof parts = [];

    parts.forEach((part) => {
      if (part.type !== 'text') {
        newParts.push(part);
        return;
      }
      let lastIndex = 0;
      let match;
      const str = part.content;

      while ((match = linkRegex.exec(str)) !== null) {
        const matchIndex = match.index;
        if (matchIndex > lastIndex) {
          newParts.push({ type: 'text', content: str.substring(lastIndex, matchIndex) });
        }
        newParts.push({ type: 'link', content: match[1]!, url: match[2]! });
        lastIndex = linkRegex.lastIndex;
      }

      if (lastIndex < str.length) {
        newParts.push({ type: 'text', content: str.substring(lastIndex) });
      }
    });

    parts = newParts;
    newParts = [];

    // 2. Negritas Markdown **Texto**
    const boldRegex = /\*\*([^*]+)\*\*/g;

    parts.forEach((part) => {
      if (part.type !== 'text') {
        newParts.push(part);
        return;
      }
      let lastIndex = 0;
      let match;
      const str = part.content;

      while ((match = boldRegex.exec(str)) !== null) {
        const matchIndex = match.index;
        if (matchIndex > lastIndex) {
          newParts.push({ type: 'text', content: str.substring(lastIndex, matchIndex) });
        }
        newParts.push({ type: 'bold', content: match[1]! });
        lastIndex = boldRegex.lastIndex;
      }

      if (lastIndex < str.length) {
        newParts.push({ type: 'text', content: str.substring(lastIndex) });
      }
    });

    parts = newParts;
    newParts = [];

    // 3. Itálicas Markdown _Texto_
    const italicRegex = /_([^_]+)_/g;

    parts.forEach((part) => {
      if (part.type !== 'text') {
        newParts.push(part);
        return;
      }
      let lastIndex = 0;
      let match;
      const str = part.content;

      while ((match = italicRegex.exec(str)) !== null) {
        const matchIndex = match.index;
        if (matchIndex > lastIndex) {
          newParts.push({ type: 'text', content: str.substring(lastIndex, matchIndex) });
        }
        newParts.push({ type: 'text', content: match[1]! });
        lastIndex = italicRegex.lastIndex;
      }

      if (lastIndex < str.length) {
        newParts.push({ type: 'text', content: str.substring(lastIndex) });
      }
    });

    parts = newParts;

    return parts.map((part, i) => {
      if (part.type === 'bold') {
        return <strong key={i} className="font-extrabold text-ap-primary">{part.content}</strong>;
      }
      if (part.type === 'link') {
        return (
          <a
            key={i}
            href={part.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ap-success hover:underline font-bold inline-flex items-center"
          >
            {part.content}
          </a>
        );
      }
      return part.content;
    });
  };

  const renderNoticeCard = (line: string, key: any) => {
    let rawContent = line.replace(/^[\*\-]\s*/, '').trim();

    // Extraer todos los enlaces de la noticia
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const links: { label: string; url: string }[] = [];
    let match;

    while ((match = linkRegex.exec(rawContent)) !== null) {
      links.push({
        label: match[1]!.trim(),
        url: match[2]!.trim()
      });
    }

    // 1. Remover del cuerpo de la noticia cualquier bloque de enlace Markdown [Texto](url)
    let cleanContent = rawContent.replace(/\[[^\]]+\]\([^)]+\)/g, '');

    // 2. Limpiar corchetes, paréntesis y itálicas que envolvían a la cita
    cleanContent = cleanContent.replace(/\[\[/g, '').replace(/\]\]/g, '');
    cleanContent = cleanContent.replace(/\[/g, '').replace(/\]/g, '');
    cleanContent = cleanContent.replace(/\(_*\s*\/+\s*_*?\)/g, ''); // Limpia (_ / _)
    cleanContent = cleanContent.replace(/\(_*\s*_?\)/g, '');       // Limpia (_ _) o (_)
    cleanContent = cleanContent.replace(/\(\s*\)/g, '');           // Limpia ()
    cleanContent = cleanContent.replace(/_\s*_/g, '');
    cleanContent = cleanContent.replace(/_\(\s*\)_/g, '');

    // 3. Limpiar barras inclinadas sueltas o comas residuales al final del texto
    cleanContent = cleanContent.replace(/\s*[\/,\s_*]+\s*$/, '');
    cleanContent = cleanEmojis(cleanContent).trim();

    // Asegurar punto final único si no está vacío
    if (cleanContent && !cleanContent.endsWith('.')) {
      cleanContent += '.';
    }

    // 4. Extraer fecha de publicación y calcular tiempo relativo al leer (no del texto guardado)
    let pubDate = '';
    let timeAgo = '';

    const pubBlockRegex = /(?:^|·\s*)pub\.\s*(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2})\s*:?\s*/i;
    const pubMatch = cleanContent.match(pubBlockRegex);
    if (pubMatch) {
      pubDate = pubMatch[1]!.trim();
      cleanContent = cleanContent.replace(pubBlockRegex, '').trim();
    }

    cleanContent = stripStaleRelativePrefix(cleanContent);

    const parsedPub = pubDate ? parsePubDateVenezuela(pubDate) : null;
    if (parsedPub) {
      timeAgo = formatRelativeFromNow(parsedPub);
    }

    if (!cleanContent) return null;

    return (
      <div key={key} className="bg-white/90 border border-ap-border/60 hover:border-ap-muted rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.015)] flex flex-col gap-2 transition-all duration-200 hover:shadow-sm">
        
        {/* Cabecera estilo Apple News (Medio + Hora relativa) */}
        <div className="flex items-center justify-between text-[10px] font-extrabold text-ap-muted tracking-wider uppercase font-outfit border-b border-ap-border/40 pb-1.5 shrink-0">
          <div className="flex flex-wrap items-center gap-1">
            {links.length > 0 ? (
              links.map((link, i) => (
                <span key={i} className="inline-flex items-center">
                  {i > 0 && <span className="mx-1 text-ap-border">•</span>}
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ap-primary hover:text-ap-success transition-colors underline decoration-ap-border hover:decoration-ap-success"
                  >
                    {cleanEmojis(link.label)}
                  </a>
                </span>
              ))
            ) : (
              <span className="text-ap-primary">Reporte Oficial</span>
            )}
          </div>
          <span className="text-[9px] text-ap-muted/80 text-right leading-tight">
            {pubDate && <span className="block text-ap-secondary/90 normal-case tracking-normal font-semibold">{pubDate}</span>}
            {timeAgo && <span>{timeAgo}</span>}
          </span>
        </div>

        {/* Cuerpo de la Noticia */}
        <p className="text-[13px] text-ap-secondary leading-relaxed font-semibold mt-1">
          {parseInlineFormatting(cleanContent)}
        </p>
      </div>
    );
  };

  const parseMarkdown = (text: string) => {
    if (!text) return null;
    let lines = text.split('\n');

    // Filtrar preámbulos e introducciones conversacionales de la IA
    lines = lines.filter(line => {
      const trimmed = line.trim().toLowerCase();
      if (
        trimmed.startsWith('claro') ||
        trimmed.includes('a continuación') ||
        trimmed.includes('elaborado a partir de') ||
        trimmed.includes('resumen informativo') ||
        trimmed.includes('aquí tiene') ||
        trimmed.includes('aquí está')
      ) {
        return false;
      }
      return true;
    });

    // Quitar líneas vacías iniciales
    while (lines.length > 0 && lines[0]!.trim() === '') {
      lines.shift();
    }

    return lines.map((line, index) => {
      const trimmed = line.trim();

      // Interceptar y limpiar separadores de símbolos sueltos (ej: --- o *** o * * *)
      if (/^[*\-_.\s]+$/.test(trimmed)) {
        const cleanSym = trimmed.replace(/\s+/g, '');
        if (cleanSym === '---' || cleanSym === '***' || cleanSym === '___') {
          return <hr key={index} className="border-ap-border my-5" />;
        }
        return null;
      }

      // Títulos de nivel 2 (ej: ## Política)
      if (trimmed.startsWith('##')) {
        const title = cleanEmojis(trimmed.replace(/^##\s*/, '').replace(/\*\*/g, ''));
        return (
          <h3 key={index} className="font-extrabold text-ap-primary text-[11px] mt-6 mb-2.5 font-outfit uppercase tracking-wider opacity-60">
            {title}
          </h3>
        );
      }

      // Títulos de nivel 3 (ej: ### DW)
      if (trimmed.startsWith('###')) {
        const title = cleanEmojis(trimmed.replace(/^###\s*/, '').replace(/\*\*/g, ''));
        return (
          <h4 key={index} className="font-extrabold text-ap-primary text-[11px] mt-4 mb-2 font-outfit uppercase tracking-wider opacity-55">
            {title}
          </h4>
        );
      }

      // Títulos principales (ej: # Título)
      if (trimmed.startsWith('#')) {
        const title = cleanEmojis(trimmed.replace(/^#\s*/, '').replace(/\*\*/g, ''));
        return (
          <h2 key={index} className="font-extrabold text-ap-primary text-[15px] mt-2 mb-4 font-outfit text-center border-b border-ap-border pb-2.5 uppercase tracking-wide">
            {title}
          </h2>
        );
      }

      // Elemento de lista/noticia (ej: * Noticia o - Noticia)
      if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
        return renderNoticeCard(trimmed, index);
      }

      // Párrafos normales
      if (trimmed.length > 0) {
        return (
          <p key={index} className="text-[13px] text-ap-secondary leading-relaxed my-2">
            {parseInlineFormatting(cleanEmojis(trimmed))}
          </p>
        );
      }

      return null;
    });
  };

  const activeEntry = history[historyIndex];

  return (
    <div className="fixed z-[1500] bg-ap-surface border border-ap-border shadow-agentos-md flex flex-col
                    left-0 right-0 bottom-0 max-h-[70dvh] rounded-t-2xl
                    md:left-0 md:top-28 md:bottom-4 md:right-auto md:w-[23rem] md:border-l-0 md:rounded-l-none md:rounded-r-xl md:max-h-none animate-slideRight">
      
      {/* Paginador + Controles integrados en barra unificada */}
      <div className="flex items-center justify-between px-3 py-2 bg-ap-surface border-b border-ap-border text-[10.5px] font-bold text-ap-secondary shrink-0 font-outfit select-none gap-2">
        {!loading && !error && history.length > 1 ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setHistoryIndex((prev) => Math.min(prev + 1, history.length - 1))}
              disabled={historyIndex === history.length - 1}
              className="px-2 py-0.5 bg-white border border-ap-border hover:border-ap-muted rounded-md shadow-sm hover:bg-ap-surface-hover active:scale-95 disabled:opacity-40 transition-all cursor-pointer disabled:cursor-not-allowed text-ap-primary"
            >
              Anterior
            </button>
            <button
              onClick={() => setHistoryIndex((prev) => Math.max(prev - 1, 0))}
              disabled={historyIndex === 0}
              className="px-2 py-0.5 bg-white border border-ap-border hover:border-ap-muted rounded-md shadow-sm hover:bg-ap-surface-hover active:scale-95 disabled:opacity-40 transition-all cursor-pointer disabled:cursor-not-allowed text-ap-primary"
            >
              Siguiente
            </button>
          </div>
        ) : (
          <div className="w-[105px]" /> // spacer
        )}

        <span className="text-ap-muted text-[9px] uppercase tracking-wider text-center flex-1 truncate">
          {!loading && !error && history.length > 1
            ? `Reporte ${historyIndex + 1}/${history.length}`
            : 'Boletín de noticias'}
        </span>

        <div className="flex items-center gap-1.5">
          <button
            onClick={fetchNews}
            disabled={loading}
            className="text-ap-muted hover:text-ap-primary p-1 rounded-md transition-colors active:scale-95 disabled:opacity-50"
            aria-label="Actualizar reportes"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={onClose} className="text-ap-muted hover:text-ap-primary p-1 rounded-md transition-colors" aria-label="Cerrar noticias">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 overflow-y-auto p-5 bg-ap-bg/30">
        {loading && (
          <div className="h-full flex flex-col items-center justify-center py-20 text-center">
            {/* Animación del logo Otras Maneras */}
            <div className="relative flex flex-col items-center justify-center mb-4">
              <style dangerouslySetInnerHTML={{__html: `
                .ld-svg-m { width: 44px; height: 44px; display: block; }
                .ld-body-m { fill: #072AC8; }
                .tip-c-m {
                  fill: #072AC8;
                  stroke: #072AC8;
                  stroke-width: 8px;
                  stroke-linejoin: round;
                  stroke-linecap: round;
                  animation: tipCycleM 2.56s linear infinite;
                }
                @keyframes tipCycleM {
                  0%, 13% { fill: #FCF300; stroke: #FCF300; }
                  18% { fill: #072AC8; stroke: #072AC8; }
                  100% { fill: #072AC8; stroke: #072AC8; }
                }
              `}} />
              
              <svg className="ld-svg-m animate-pulse" viewBox="0 0 920 920" xmlns="http://www.w3.org/2000/svg" style={{ animationDuration: '3.5s' }}>
                <path className="ld-body-m" d="M460.31,364.8c-52.33-.17-95,42.4-95.24,95-.22,52,42.1,94.73,94.42,95.43,51.63.68,95.94-42.55,96-93.83C555.67,405.18,509.57,363.79,460.31,364.8ZM611,659.76a51.85,51.85,0,0,0,13.42,35.13,52.5,52.5,0,0,0,71,6.71c21.19-16.24,26.17-46.64,11.5-70.18-14.06-22.56-43.4-30.34-67.61-17.73-3.34,1.74-5.51,1.75-8.23-1-14.67-15-29.51-29.83-44.3-44.71q-15.32-15.44-30.64-30.84c-3.71-3.72-8.17-4.39-12.89-2.38-4.3,1.82-6,5.53-6.19,10-.16,4.23,2.3,7.14,5.06,9.92q36.79,37,73.64,74c2.72,2.72,3.18,4.82,1.16,8.15A42.84,42.84,0,0,0,611,659.76Zm51.23-347.24c28.84,0,51.73-22.35,52.09-50a51.56,51.56,0,0,0-50-52.53c-38.57-1-63.78,38.88-47,74.61,1.67,3.55,1.22,5.57-1.42,8.18q-35.54,35.14-70.87,70.5c-2.12,2.11-4.41,4.09-5.86,6.78-2.58,4.81-1.62,11.12,2.14,14.22s9.75,3,14-.21a44.47,44.47,0,0,0,4.36-4.11q35.93-35.82,71.77-71.73c2.89-2.91,5.17-3.25,8.64-1.17A40.82,40.82,0,0,0,662.27,312.52ZM256.6,709.68c38,1.2,64.12-40.11,46.44-73.78-1.65-3.15-1.3-4.92,1.15-7.25,5.67-5.4,11.05-11.09,16.57-16.64,19-19.15,38.16-38.18,57-57.47,6.29-6.43,6.47-14,1.32-18.58-4.65-4.1-11.47-2.58-17.54,3.54q-36,36.39-72.18,72.71c-2.54,2.57-4.67,2.93-7.84,1.18a50.33,50.33,0,0,0-23.44-6.26c-27.24-.64-51,21.91-51.88,49C205.33,685.44,227.27,708.76,256.6,709.68Zm-50-449.46c-1.74,38.43,39.31,64.67,73.71,46.89,4.22-2.18,6.46-1.33,9.4,1.64,15.13,15.27,30.4,30.4,45.63,45.58,9.67,9.65,19.28,19.37,29.07,28.91a10.78,10.78,0,0,0,14.55.83c4.33-3.68,5.05-9.88,1.51-14.89a46,46,0,0,0-5.22-6Q340,328,304.76,292.92c-3.06-3-3.21-5.5-1.36-9.14a47.42,47.42,0,0,0,4.39-31.11c-5.22-26.86-28.34-44.69-54.7-42.47C226.06,212.48,206.1,235.73,206.57,260.22Zm243.15,31.06h0c0,6,0,12,0,18,0,9.83-.09,19.66.17,29.48.17,6.32,4.55,10.12,10.74,10,6-.14,9.72-3.85,10.09-10.11.12-2,.08-4,.08-6,0-29,0-58-.06-86.94,0-4,.64-6.66,5.16-8.25,23.17-8.11,35.73-27.1,34.86-51.88-1.08-30.62-30.9-53.68-60.85-47-22.76,5-39.59,24.24-40.69,47.8-1,22.19,11.29,42.53,34,50.6,5.08,1.8,6.59,4.41,6.52,9.42C449.58,261.29,449.72,276.29,449.72,291.28ZM628.17,449.39c-15.33,0-30.66-.95-46,.24-7,.55-10.84,4.76-10.39,11.34s4.35,9.78,12,9.8c29.16.07,58.32.12,87.48,0,4.86,0,7.57,1.31,8.92,6.4,3.05,11.47,10.34,20.09,20.26,26.3,19.16,12,42.1,10.56,59.79-3.4,16.45-13,22.73-35.94,15.59-57-6.87-20.25-26.54-33.95-48.8-34-20.32-.05-40.3,14.2-46.54,34-1.68,5.34-4.47,6.44-9.32,6.38C656.82,449.28,642.49,449.39,628.17,449.39Zm-335.29,21.4h0c14.33,0,28.65,0,43,0,8.65,0,12.83-3.46,12.93-10.39s-4.25-10.8-12.44-11.26c-.83,0-1.67-.05-2.5-.05-27.83,0-55.65-.2-83.47.14-5.89.07-8.69-1.42-10.87-7.19-7.33-19.36-21.91-30.45-42.39-32.48-18.79-1.87-34.53,5.09-45.48,20.67-12,17.14-13.59,35.62-3.58,54.22,10.53,19.58,27.56,29.05,49.55,26.73,21.18-2.24,35.86-14.3,42.84-34.73,1.46-4.28,3.66-5.73,7.94-5.68C263.22,470.88,278.05,470.79,292.88,470.79Zm178,155.75c0-3.67,0-7.33,0-11,0-11,.06-22-.12-33-.12-7.3-4.38-11.45-11.11-11.32-5.79.11-9.66,4.58-9.92,11.49-.06,1.83,0,3.67,0,5.5q0,40.21,0,80.43c0,3.9-.43,6.81-5.07,8.34-22.65,7.49-35.48,26.21-34.85,50.14.8,30.78,29.43,53.76,59.62,47.83,22.63-4.43,39.62-22.7,41.17-44.26,1.78-24.84-11.13-45.56-33.87-53.47-4.76-1.66-6-4.19-5.94-8.76C471,654.51,470.86,640.52,470.87,626.54Z" />
                {[
                  { cx: 661.5, cy: 660.5 }, // Bottom-Right
                  { cx: 726.5, cy: 460.5 }, // Right
                  { cx: 662.0, cy: 261.5 }, // Top-Right
                  { cx: 459.5, cy: 188.0 }, // Top
                  { cx: 257.0, cy: 260.5 }, // Top-Left
                  { cx: 192.0, cy: 460.0 }, // Left
                  { cx: 256.5, cy: 658.0 }, // Bottom-Left
                  { cx: 460.0, cy: 724.0 }, // Bottom
                ].map((t, i) => {
                  const delay = i === 0 ? "0s" : `-${(2.56 - i * 0.32).toFixed(2)}s`;
                  return (
                    <circle
                      key={i}
                      cx={t.cx}
                      cy={t.cy}
                      r="52"
                      className="tip-c-m"
                      style={{ animationDelay: delay }}
                    />
                  );
                })}
              </svg>
            </div>
            <h3 className="text-ap-primary font-outfit font-extrabold text-[13px] uppercase tracking-wide">Compilando boletín</h3>
            <p className="text-ap-muted text-[11px] mt-1 font-medium animate-pulse">Esto puede demorar unos segundos...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-12 px-4">
            <p className="text-[13.5px] text-rose-600 font-semibold mb-4">{error}</p>
            <button
              onClick={fetchNews}
              className="inline-flex items-center gap-1.5 bg-ap-primary hover:bg-ap-secondary text-white text-[12px] font-bold px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95"
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-3">
            {parseMarkdown(activeEntry?.summary || '')}
          </div>
        )}
      </div>
    </div>
  );
}
