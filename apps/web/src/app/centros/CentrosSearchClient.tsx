'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { ESTADO_COLOR, ESTADO_LABEL } from '@/lib/centros';

type CentroRow = {
  name: string;
  address: string | null;
  recibe: unknown;
  estado: string;
  tipo: string;
  pais: string | null;
  ciudad: string | null;
  latitude: string | null;
  longitude: string | null;
  contacto: string | null;
  horario: string | null;
  fuente: string | null;
  paisSlug: string;
  ciudadSlug: string;
  verification: {
    score: number;
    tier: 'high' | 'medium' | 'basic';
    sourceCount: number;
  };
};

interface CentrosSearchClientProps {
  tipoVista: 'general' | 'pais' | 'ciudad';
  paisName?: string;
  paisSlug?: string;
  ciudadName?: string;
  ciudadSlug?: string;
  // Para vista general
  byPais?: Record<string, { slug: string; ciudades: Record<string, { slug: string; list: CentroRow[] }> }>;
  paisesList?: string[];
  // Para vista de país
  byCiudad?: Record<string, { slug: string; list: CentroRow[] }>;
  ciudadesList?: string[];
  totalCentrosPais?: number;
  // Para vista de ciudad
  ciudadCenters?: CentroRow[];
}

export default function CentrosSearchClient({
  tipoVista,
  paisName = '',
  paisSlug = '',
  ciudadName = '',
  ciudadSlug = '',
  byPais = {},
  paisesList = [],
  byCiudad = {},
  ciudadesList = [],
  totalCentrosPais = 0,
  ciudadCenters = [],
}: CentrosSearchClientProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // 1. VISTA GENERAL
  if (tipoVista === 'general') {
    // Filtrar países y ciudades en base a la búsqueda
    const filteredPaises = paisesList.filter((pais) => {
      const pInfo = byPais[pais];
      const matchPais = pais.toLowerCase().includes(searchQuery.toLowerCase());
      const ciudades = Object.keys(pInfo.ciudades);
      const matchCiudad = ciudades.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchPais || matchCiudad;
    });

    return (
      <div className="mt-6">
        {/* Buscador */}
        <div className="relative mb-6">
          <div className="flex items-center bg-ap-surface border border-ap-border rounded-xl px-3 py-2.5 focus-within:border-ap-primary transition-colors shadow-sm">
            <Search size={18} className="text-ap-muted mr-2" />
            <input
              type="text"
              placeholder="Buscar por país o ciudad..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-[14px] text-ap-primary bg-transparent outline-none placeholder-ap-muted font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-ap-muted hover:text-ap-primary p-0.5 shrink-0"
                aria-label="Limpiar búsqueda"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {filteredPaises.map((pais) => {
            const pInfo = byPais[pais];
            // Filtrar las ciudades del país si hay búsqueda
            const ciudades = Object.keys(pInfo.ciudades)
              .sort()
              .filter(
                (c) =>
                  pais.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  c.toLowerCase().includes(searchQuery.toLowerCase())
              );

            const totalPaisCenters = ciudades.reduce((acc, curr) => acc + pInfo.ciudades[curr].list.length, 0);

            if (ciudades.length === 0) return null;

            return (
              <section key={pais} className="bg-ap-surface border border-ap-border rounded-2xl p-5 shadow-sm">
                <h2 className="text-[18px] font-extrabold text-ap-primary font-outfit border-b border-ap-border/50 pb-2 flex justify-between items-center">
                  <span>{pais}</span>
                  <Link
                    href={`/centros/${pInfo.slug}`}
                    className="text-[12px] font-semibold text-ap-secondary hover:text-ap-primary hover:underline"
                  >
                    Ver todo el país ({totalPaisCenters})
                  </Link>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                  {ciudades.map((ciudad) => {
                    const cInfo = pInfo.ciudades[ciudad];
                    return (
                      <Link
                        key={ciudad}
                        href={`/centros/${pInfo.slug}/${cInfo.slug}`}
                        className="flex items-center justify-between p-3 rounded-xl border border-ap-border hover:border-ap-muted bg-ap-bg/30 hover:bg-ap-surface-hover transition-all"
                      >
                        <span className="text-[13px] font-bold text-ap-secondary">{ciudad}</span>
                        <span className="text-[11px] font-semibold text-ap-muted bg-ap-bg px-2 py-0.5 rounded-full">
                          {cInfo.list.length}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {filteredPaises.length === 0 && (
            <div className="text-center py-8 text-ap-muted font-medium">No se encontraron países ni ciudades.</div>
          )}
        </div>
      </div>
    );
  }

  // 2. VISTA DE PAÍS
  if (tipoVista === 'pais') {
    return (
      <div>
        {/* Buscador */}
        <div className="relative mb-6">
          <div className="flex items-center bg-ap-surface border border-ap-border rounded-xl px-3 py-2.5 focus-within:border-ap-primary transition-colors shadow-sm">
            <Search size={18} className="text-ap-muted mr-2" />
            <input
              type="text"
              placeholder="Buscar por nombre, dirección o insumos que recibe..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-[14px] text-ap-primary bg-transparent outline-none placeholder-ap-muted font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-ap-muted hover:text-ap-primary p-0.5 shrink-0"
                aria-label="Limpiar búsqueda"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {ciudadesList.map((ciudad) => {
            const cInfo = byCiudad[ciudad];
            // Filtrar los centros de la ciudad
            const filteredCentros = cInfo.list.filter((c) => {
              const recibe = Array.isArray(c.recibe) ? (c.recibe as string[]) : [];
              const matchText =
                c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (c.address || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                recibe.some((r) => r.toLowerCase().includes(searchQuery.toLowerCase())) ||
                ciudad.toLowerCase().includes(searchQuery.toLowerCase());
              return matchText;
            });

            if (filteredCentros.length === 0) return null;

            return (
              <section key={ciudad} className="bg-ap-surface border border-ap-border rounded-2xl p-5 shadow-sm">
                <h2 className="text-[16px] font-extrabold text-ap-primary font-outfit border-b border-ap-border/50 pb-2 flex justify-between items-center">
                  <span>{ciudad}</span>
                  <Link
                    href={`/centros/${paisSlug}/${cInfo.slug}`}
                    className="text-[11.5px] font-bold text-ap-primary/80 hover:text-ap-primary hover:underline"
                  >
                    Ver solo {ciudad} ({filteredCentros.length})
                  </Link>
                </h2>
                <ul className="mt-4 divide-y divide-ap-border/50">
                  {[...filteredCentros]
                    .sort((a, b) => b.verification.score - a.verification.score)
                    .map((c, i) => {
                      const recibe = Array.isArray(c.recibe) ? (c.recibe as string[]) : [];
                      return (
                        <li key={i} className="py-3 text-[13px] first:pt-0 last:pb-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                              <span className="font-bold text-ap-primary">{c.name}</span>
                              {c.verification?.tier === 'high' && (
                                <span className="shrink-0 text-[8.5px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full font-sans">
                                  Verificación Cruzada ({c.verification.sourceCount})
                                </span>
                              )}
                              {c.verification?.tier === 'medium' && (
                                <span className="shrink-0 text-[8.5px] font-bold text-sky-800 bg-sky-50 border border-sky-200 px-1.5 py-0.2 rounded-full font-sans">
                                  Verificado
                                </span>
                              )}
                            </div>
                            <span className="shrink-0 text-[10px] font-semibold text-ap-muted bg-ap-bg border border-ap-border px-2 py-0.5 rounded-full capitalize">
                              {c.tipo}
                            </span>
                          </div>
                          {c.address && <p className="text-ap-secondary mt-0.5 text-[12.5px]">{c.address}</p>}
                          {recibe.length > 0 && (
                            <p className="text-[12px] text-ap-muted mt-1.5 font-medium">
                              <span className="font-semibold text-ap-secondary">Recibe:</span> {recibe.join(', ')}
                            </p>
                          )}
                          {c.latitude && c.longitude && (
                            <div className="mt-2 flex justify-start">
                              <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10.5px] font-bold text-ap-primary hover:underline bg-ap-bg border border-ap-border px-2 py-0.5 rounded-lg hover:bg-ap-surface-hover transition-colors"
                              >
                                Cómo llegar (Google Maps)
                              </a>
                            </div>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </section>
            );
          })}
          {ciudadesList.every((ciudad) => {
            const cInfo = byCiudad[ciudad];
            return cInfo.list.filter((c) => {
              const recibe = Array.isArray(c.recibe) ? (c.recibe as string[]) : [];
              return (
                c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (c.address || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                recibe.some((r) => r.toLowerCase().includes(searchQuery.toLowerCase()))
              );
            }).length === 0;
          }) && <div className="text-center py-8 text-ap-muted font-medium">No se encontraron centros de acopio.</div>}
        </div>
      </div>
    );
  }

  // 3. VISTA DE CIUDAD
  const filteredCiudadCenters = ciudadCenters.filter((c) => {
    const recibe = Array.isArray(c.recibe) ? (c.recibe as string[]) : [];
    return (
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.address || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      recibe.some((r) => r.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  return (
    <div>
      {/* Buscador */}
      <div className="relative mb-6">
        <div className="flex items-center bg-ap-surface border border-ap-border rounded-xl px-3 py-2.5 focus-within:border-ap-primary transition-colors shadow-sm">
          <Search size={18} className="text-ap-muted mr-2" />
          <input
            type="text"
            placeholder="Buscar por nombre, dirección o insumos que recibe..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-[14px] text-ap-primary bg-transparent outline-none placeholder-ap-muted font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-ap-muted hover:text-ap-primary p-0.5 shrink-0"
              aria-label="Limpiar búsqueda"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {filteredCiudadCenters.map((c, i) => {
          const recibe = Array.isArray(c.recibe) ? (c.recibe as string[]) : [];
          return (
            <div
              key={i}
              className="bg-ap-surface border border-ap-border rounded-2xl p-5 shadow-sm hover:border-ap-muted transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h2 className="text-[16px] font-bold text-ap-primary font-outfit leading-snug">
                      {c.name}
                    </h2>
                    {c.verification?.tier === 'high' && (
                      <span className="shrink-0 text-[9px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full font-sans">
                        Verificación Cruzada ({c.verification.sourceCount})
                      </span>
                    )}
                    {c.verification?.tier === 'medium' && (
                      <span className="shrink-0 text-[9px] font-bold text-sky-800 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-full font-sans">
                        Verificado
                      </span>
                    )}
                  </div>
                  {c.address && <p className="text-[13px] text-ap-secondary mt-1">{c.address}</p>}
                </div>
                <span className="shrink-0 text-[10px] font-extrabold text-ap-muted bg-ap-bg border border-ap-border px-2 py-0.5 rounded-full capitalize">
                  {c.tipo}
                </span>
              </div>

              <div className="mt-4 pt-3 border-t border-ap-border/30 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                {recibe.length > 0 && (
                  <div>
                    <span className="font-bold text-ap-secondary block mb-0.5">Recibe:</span>
                    <span className="text-ap-muted font-medium">{recibe.join(', ')}</span>
                  </div>
                )}
                {c.estado && (
                  <div>
                    <span className="font-bold text-ap-secondary block mb-0.5">Estado actual:</span>
                    <span className="inline-flex items-center gap-1.5 font-bold text-ap-primary">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{
                          backgroundColor:
                            c.estado === 'abierto'
                              ? '#059669'
                              : c.estado === 'lleno'
                              ? '#d97706'
                              : '#ef4444',
                        }}
                      />
                      <span className="capitalize">{c.estado}</span>
                    </span>
                  </div>
                )}
              </div>

              {c.latitude && c.longitude && (
                <div className="mt-4 pt-3 border-t border-ap-border/30 flex justify-end">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-ap-primary hover:underline bg-ap-bg border border-ap-border px-2.5 py-1.5 rounded-lg hover:bg-ap-surface-hover transition-colors shadow-sm"
                  >
                    Cómo llegar (Google Maps)
                  </a>
                </div>
              )}
            </div>
          );
        })}
        {filteredCiudadCenters.length === 0 && (
          <div className="text-center py-8 text-ap-muted font-medium">No se encontraron centros de acopio.</div>
        )}
      </div>
    </div>
  );
}
