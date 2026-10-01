import Link from 'next/link';
import type { CSSProperties } from 'react';
import { Github } from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  hrefLang?: string;
}

// Paleta de marca (azul/amarillo de Venezuela). Se aplica como override de los
// tokens --ap-* en el <main> de las páginas de contenido (no toca el mapa ni admin).
export const BRAND_PALETTE = {
  '--ap-bg': '#F5F7FA',
  '--ap-surface': '#FFFFFF',
  '--ap-primary': '#003D8F',
  '--ap-secondary': '#1E293B',
  '--ap-muted': '#64748B',
  '--ap-border': 'rgba(0,61,143,0.14)',
} as CSSProperties;

// Navegación estándar (español) para las páginas de contenido.
export const ES_NAV: NavItem[] = [
  { label: 'Inicio', href: '/' },
  { label: 'Resumen', href: '/resumen' },
  { label: 'Docs & API', href: '/docs' },
  { label: 'Datos Abiertos', href: '/data' },
  { label: 'Refugios', href: '/refugios' },
  { label: 'Centros', href: '/centros' },
  { label: 'Blog', href: '/blog' },
  { label: 'Acerca', href: '/acerca' },
];

export const DEFAULT_FOOTER_NOTE =
  'AcopioVE es una iniciativa humanitaria comunitaria e independiente para la respuesta al terremoto de Venezuela de 2026, parte del ecosistema helpmaps.net. No es un sitio gubernamental. Datos bajo licencia CC-BY-4.0.';

// Etiqueta superior (eyebrow) tipográfica, en mayúsculas espaciadas.
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-ap-muted">
      {children}
    </span>
  );
}

export function SiteHeader({
  nav,
  active,
  right,
  wordmarkHref = '/',
}: {
  nav: NavItem[];
  active?: string;
  right?: React.ReactNode;
  wordmarkHref?: string;
}) {
  return (
    <header className="sticky top-0 z-30 bg-ap-surface/85 backdrop-blur-md border-b border-ap-border">
      <div className="max-w-[1000px] mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <div className="shrink-0 flex items-center gap-2">
          <Link href={wordmarkHref} className="flex items-center" aria-label="AcopioVE — inicio">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-lockup.png" alt="AcopioVE — Centros de Acopio Venezuela" width="92" height="29" className="h-7 w-auto" />
          </Link>
          <span className="hidden sm:inline-flex items-center text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-[#003D8F] border border-blue-200/80">
            + HelpMaps
          </span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          {nav.length > 0 && (
            <nav className="flex items-center gap-0.5 overflow-x-auto">
              {nav.map((n) => {
                const on = active === n.href;
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    hrefLang={n.hrefLang}
                    aria-current={on ? 'page' : undefined}
                    className={`text-[13px] font-semibold px-2.5 py-1.5 rounded-md whitespace-nowrap transition-colors ${
                      on ? 'text-ap-primary' : 'text-ap-secondary hover:text-ap-primary'
                    }`}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          )}
          {right}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({ nav = ES_NAV, note = DEFAULT_FOOTER_NOTE }: { nav?: NavItem[]; note?: string }) {
  return (
    <footer className="border-t border-ap-border bg-ap-surface mt-16">
      <div className="max-w-[1000px] mx-auto px-4 py-10 flex flex-col items-center text-center">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5">
          <span className="text-[14px] font-extrabold text-ap-primary font-outfit">AcopioVE</span>
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="text-[13px] font-semibold text-ap-secondary hover:text-ap-primary transition-colors">
              {n.label}
            </Link>
          ))}
          <a
            href="https://github.com/otras-maneras/acopiove-api"
            target="_blank"
            rel="noopener noreferrer"
            title="API de Datos en GitHub"
            className="text-ap-muted hover:text-ap-primary transition-colors inline-flex items-center ml-1"
            aria-label="GitHub de la API de AcopioVE"
          >
            <Github size={17} />
          </a>
        </div>
        <p className="text-[12px] text-ap-muted mt-4 max-w-2xl leading-relaxed mx-auto">{note}</p>
      </div>
    </footer>
  );
}
