'use client';

import { useState } from 'react';
import { X, AlertTriangle, RefreshCw } from 'lucide-react';
import type { Entidad, OrigenCapa } from './entidad';
import type { EntidadClase, EntidadTipo } from '@/lib/busqueda-avanzada/types';

// Carga de una API externa arbitraria, del lado del cliente: se mapea a Entidad y
// se dibuja en el mapa sin pasar por el servidor ni guardarse en ningún lado.

function formaDe(origen: string): { tipo: EntidadTipo; clase: EntidadClase } {
  if (origen === 'localizado' || origen === 'desaparecido') return { tipo: 'persona', clase: 'persona' };
  if (origen === 'danos') return { tipo: 'dano', clase: 'reporte' };
  if (origen === 'insumos') return { tipo: 'necesidad', clase: 'reporte' };
  return { tipo: 'servicio', clase: 'reporte' };
}

/** Deduce la capa de un registro externo a partir de sus campos de texto. */
function origenDe(raw: string): OrigenCapa {
  const s = (raw || '').toLowerCase();
  if (s.includes('localizado')) return 'localizado';
  if (s.includes('desaparecido')) return 'desaparecido';
  if (s.includes('dano') || s.includes('daño') || s.includes('colapso')) return 'danos';
  if (s.includes('insumo') || s.includes('acopio')) return 'insumos';
  return 'reporte_ve';
}

function aEntidad(id: string, nombre: string, origen: OrigenCapa, fuente: string, campos: Partial<Entidad>): Entidad {
  const { tipo, clase } = formaDe(origen);
  return {
    id,
    nombre,
    tipo,
    clase,
    origen,
    status: campos.status ?? 'Reporte Externo',
    lugar: campos.lugar ?? 'Ubicación Externa',
    observaciones: campos.observaciones ?? null,
    cedula: campos.cedula ?? null,
    foto: campos.foto ?? null,
    categorias: [],
    telefono: null,
    fuente,
    fuentes: [fuente],
    confianza: 1,
    fuente_url: null,
    ficha_url: null,
    lat: campos.lat ?? null,
    lng: campos.lng ?? null,
    fecha: campos.fecha ?? null,
  };
}

export default function ImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (nombre: string, entidades: Entidad[]) => void;
}) {
  const [url, setUrl] = useState('');
  const [nombre, setNombre] = useState('API Temporal');
  const [headerKey, setHeaderKey] = useState('');
  const [headerVal, setHeaderVal] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function importar() {
    if (!url) return;
    setImporting(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (headerKey && headerVal) headers[headerKey.trim()] = headerVal.trim();

      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`Error HTTP! Estado: ${res.status}`);
      const json = await res.json();

      const fuente = nombre || 'API Temporal';
      let lista: Entidad[] = [];

      if (json && json.type === 'FeatureCollection' && Array.isArray(json.features)) {
        lista = json.features.map((f: any, i: number) => {
          const props = f.properties || {};
          const [lng, lat] = Array.isArray(f.geometry?.coordinates) ? f.geometry.coordinates : [null, null];
          return aEntidad(
            String(props.id || props.slug || `custom-${i}`),
            props.nombre || props.name || props.title || `Punto Temporal ${i + 1}`,
            origenDe(props.type || props.tipo || props.status || ''),
            fuente,
            {
              status: props.status || props.estado,
              lugar: props.lugar || props.address || props.direccion,
              observaciones: props.observaciones || props.summary || props.description || null,
              cedula: props.cedula || null,
              foto: props.foto || props.photo || null,
              lat,
              lng,
              fecha: props.fecha || props.date || null,
            },
          );
        });
      } else {
        let filas: any[] = [];
        if (Array.isArray(json)) {
          filas = json;
        } else if (json && typeof json === 'object') {
          for (const val of Object.values(json)) {
            if (Array.isArray(val)) {
              filas = val;
              break;
            }
          }
        }
        if (filas.length === 0) throw new Error('No se detectó un listado o array de registros en el JSON provisto.');

        lista = filas.map((it: any, i: number) => {
          const lat = Number(it.lat ?? it.latitude ?? it.latitud ?? it.coords?.lat ?? it.geometry?.coordinates?.[1] ?? NaN);
          const lng = Number(it.lng ?? it.longitude ?? it.longitud ?? it.coords?.lng ?? it.geometry?.coordinates?.[0] ?? NaN);
          return aEntidad(
            String(it.id ?? it.slug ?? `custom-${i}`),
            it.nombre ?? it.name ?? it.title ?? it.titulo ?? `Registro ${i + 1}`,
            origenDe(it.tipo ?? it.status ?? it.estado ?? it.type ?? ''),
            fuente,
            {
              status: it.status ?? it.estado,
              lugar: it.lugar ?? it.address ?? it.direccion,
              observaciones: it.observaciones ?? it.summary ?? it.description ?? it.notes ?? null,
              cedula: it.cedula ?? null,
              foto: it.foto ?? it.photo ?? null,
              lat: isNaN(lat) ? null : lat,
              lng: isNaN(lng) ? null : lng,
              fecha: it.fecha ?? it.date ?? null,
            },
          );
        });
      }

      const conCoords = lista.filter((e) => e.lat !== null && e.lng !== null);
      if (conCoords.length === 0) {
        throw new Error('Se leyó el listado pero ninguno de los objetos contenía coordenadas válidas (lat/lng).');
      }

      onImported(fuente, conCoords);
    } catch (err: any) {
      console.error('Error cargando API:', err);
      setError(err.message || 'Error de conexión. Verifica que el endpoint sea público y tenga cabeceras CORS habilitadas.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[2000] flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-ap-surface border border-ap-border w-full max-w-md rounded-2xl shadow-agentos-md overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-ap-border flex justify-between items-center">
          <h2 className="text-[17px] font-extrabold text-ap-primary font-outfit">Cargar API Externa Temporal</h2>
          <button onClick={onClose} className="text-ap-muted hover:text-ap-primary p-1" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-[12.5px] text-ap-secondary leading-relaxed">
            Pega una URL que devuelva un listado JSON de puntos (soporta GeoJSON estándar o arrays simples de
            objetos). Se geolocalizarán del lado del cliente sin guardarse en el servidor.
          </p>

          <div className="space-y-3">
            <Campo label="Nombre de la Fuente">
              <input
                type="text"
                placeholder="Ej: API Temporal Mérida"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full px-3 py-2 text-[13.5px] bg-ap-bg border border-ap-border rounded-lg focus:outline-none focus:border-ap-primary text-ap-primary placeholder:text-ap-muted"
              />
            </Campo>
            <Campo label="URL del Endpoint JSON">
              <input
                type="url"
                placeholder="https://mi-servidor.com/api/v1/puntos"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3 py-2 text-[13.5px] bg-ap-bg border border-ap-border rounded-lg focus:outline-none focus:border-ap-primary text-ap-primary placeholder:text-ap-muted font-mono"
              />
            </Campo>
            <div className="grid grid-cols-2 gap-3.5">
              <Campo label="Header (Opcional)">
                <input
                  type="text"
                  placeholder="Ej: apikey"
                  value={headerKey}
                  onChange={(e) => setHeaderKey(e.target.value)}
                  className="w-full px-3 py-2 text-[13.5px] bg-ap-bg border border-ap-border rounded-lg focus:outline-none focus:border-ap-primary text-ap-primary placeholder:text-ap-muted font-mono"
                />
              </Campo>
              <Campo label="Valor del Header">
                <input
                  type="text"
                  placeholder="Valor del token/key"
                  value={headerVal}
                  onChange={(e) => setHeaderVal(e.target.value)}
                  className="w-full px-3 py-2 text-[13.5px] bg-ap-bg border border-ap-border rounded-lg focus:outline-none focus:border-ap-primary text-ap-primary placeholder:text-ap-muted font-mono"
                />
              </Campo>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-[12px] text-red-700 flex gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Error de importación:</span> {error}
              </div>
            </div>
          )}

          <div className="text-[11px] text-ap-muted bg-ap-bg/50 p-3 rounded-lg border border-ap-border/50">
            💡 <strong>Nota sobre CORS:</strong> El servidor de la API debe permitir peticiones externas
            (Access-Control-Allow-Origin). Si es bloqueado por el navegador, asegúrate de habilitar CORS en el origen.
          </div>
        </div>

        <div className="px-5 py-4 border-t border-ap-border bg-ap-bg/20 flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="bg-ap-bg hover:bg-ap-surface-hover border border-ap-border text-ap-secondary text-[13px] font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={importar}
            disabled={importing || !url}
            className="bg-ap-primary text-white text-[13px] font-bold px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-55 transition-opacity flex items-center gap-1.5 cursor-pointer"
          >
            {importing ? (
              <>
                <RefreshCw className="animate-spin" size={14} /> Mapeando...
              </>
            ) : (
              'Conectar y Mapear'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-ap-muted uppercase mb-1">{label}</label>
      {children}
    </div>
  );
}
