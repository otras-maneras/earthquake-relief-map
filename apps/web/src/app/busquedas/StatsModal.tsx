'use client';

import { useMemo } from 'react';
import { X } from 'lucide-react';
import type { Entidad } from './entidad';

// Estadísticas por fuente sobre el índice completo del browse (no sobre los
// resultados filtrados): responden "qué trae cada API", no "qué estoy viendo".
export default function StatsModal({
  entidades,
  customApi,
  onClose,
}: {
  entidades: Entidad[];
  customApi: { nombre: string; total: number } | null;
  onClose: () => void;
}) {
  const m = useMemo(() => {
    const esFuente = (e: Entidad, prefijo: string) =>
      e.fuentes.some((f) => f.startsWith(prefijo)) || e.fuente.startsWith(prefijo);

    let geoCount = 0, nonGeoCount = 0;
    let sosCount = 0, sosLocalizados = 0, sosDesaparecidos = 0, sosWithPhoto = 0;
    let locCount = 0, locCivis = 0, locLocalizados = 0, locOpen = 0;
    let insuCount = 0;
    let danosCount = 0, danosTotal = 0, danosEstructural = 0;
    let repCount = 0;
    const repCategories: Record<string, number> = {};
    let hubCount = 0, hubDesaparecidos = 0, hubCheckins = 0, hubSolicitudes = 0, hubOfertas = 0;
    let ayudaVzlaCount = 0, ayudaVzlaIngresados = 0, ayudaVzlaAlta = 0;
    let redhCount = 0, demanoCount = 0;
    let coreAcopios = 0, coreRefugios = 0, coreSalud = 0, coreTelefonos = 0;
    let vrSitios = 0, vrPersonas = 0;

    for (const e of entidades) {
      if (e.lat !== null && e.lng !== null) geoCount++;
      else nonGeoCount++;

      const obs = (e.observaciones || '').toLowerCase();

      if (esFuente(e, 'SOS Venezuela')) {
        sosCount++;
        if (e.origen === 'localizado') sosLocalizados++;
        else sosDesaparecidos++;
        if (e.foto) sosWithPhoto++;
      }

      const isCivis = esFuente(e, 'CIVIS Venezuela');
      const isLocalizados = esFuente(e, 'Localizados');
      if (isCivis || isLocalizados) {
        locCount++;
        if (isCivis) {
          locCivis++;
          if (e.status === 'Abierto') locOpen++;
        } else {
          locLocalizados++;
        }
      }

      switch (e.origen) {
        case 'insumos': insuCount++; break;
        case 'redh': redhCount++; break;
        case 'demano': demanoCount++; break;
        case 'core_acopio': coreAcopios++; break;
        case 'core_refugio': coreRefugios++; break;
        case 'core_salud': coreSalud++; break;
        case 'core_telefono': coreTelefonos++; break;
        case 'vr_sitio': vrSitios++; break;
        case 'vr_persona': vrPersonas++; break;
        case 'danos':
          danosCount++;
          if (e.status === 'Daño Total') danosTotal++;
          else danosEstructural++;
          break;
        case 'reporte_ve': {
          repCount++;
          const cat = e.category || 'other';
          repCategories[cat] = (repCategories[cat] || 0) + 1;
          break;
        }
        case 'hub':
          hubCount++;
          if (e.category === 'desaparecido') hubDesaparecidos++;
          else if (e.category === 'checkin') hubCheckins++;
          else if (e.category === 'solicitud') hubSolicitudes++;
          else if (e.category === 'oferta') hubOfertas++;
          else if (obs.includes('desaparecido')) hubDesaparecidos++;
          else if (obs.includes('a salvo') || obs.includes('checkin')) hubCheckins++;
          else if (obs.includes('necesidad') || obs.includes('solicitud')) hubSolicitudes++;
          else hubOfertas++;
          break;
        case 'ayudavenezuela':
          ayudaVzlaCount++;
          if (e.status === 'Ingresado' || e.status === 'Hospitalizado' || obs.includes('ingresado') || obs.includes('hospitalizado')) {
            ayudaVzlaIngresados++;
          } else {
            ayudaVzlaAlta++;
          }
          break;
      }
    }

    return {
      geoCount, nonGeoCount,
      sosCount, sosLocalizados, sosDesaparecidos, sosWithPhoto,
      locCount, locCivis, locLocalizados, locOpen,
      insuCount, danosCount, danosTotal, danosEstructural,
      repCount, repCategories,
      hubCount, hubDesaparecidos, hubCheckins, hubSolicitudes, hubOfertas,
      ayudaVzlaCount, ayudaVzlaIngresados, ayudaVzlaAlta,
      redhCount, demanoCount,
      coreAcopios, coreRefugios, coreSalud, coreTelefonos,
      vrSitios, vrPersonas,
    };
  }, [entidades]);

  const total = entidades.length + (customApi?.total ?? 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[2000] flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-ap-surface border border-ap-border w-full max-w-lg rounded-2xl shadow-agentos-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-ap-border flex justify-between items-center bg-ap-bg/10">
          <h2 className="text-[17px] font-extrabold text-ap-primary font-outfit">Estadísticas Detalladas de APIs</h2>
          <button onClick={onClose} className="text-ap-muted hover:text-ap-primary p-1" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="bg-ap-bg/50 p-4 rounded-xl border border-ap-border/50 text-center">
            <div className="text-[28px] font-extrabold text-ap-primary font-outfit">{total}</div>
            <div className="text-[11px] text-ap-muted font-bold uppercase tracking-wider mt-0.5">Total de fichas consolidadas</div>
          </div>

          <div className="border border-ap-border rounded-xl p-3.5 bg-ap-bg/35">
            <div className="text-[11px] text-ap-muted font-bold uppercase tracking-wider mb-2">Distribución en la Plataforma</div>
            <div className="grid grid-cols-2 gap-3 text-center text-[11px]">
              <div className="bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100/60">
                <div className="text-[16px] font-bold text-emerald-800">{m.geoCount}</div>
                <div className="text-[9.5px] text-emerald-650 font-semibold uppercase mt-0.5">Geolocalizados</div>
                <div className="text-[8.5px] text-emerald-600/70 font-normal mt-0.5">Visibles en mapa</div>
              </div>
              <div className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-100/60">
                <div className="text-[16px] font-bold text-amber-800">{m.nonGeoCount}</div>
                <div className="text-[9.5px] text-amber-650 font-semibold uppercase mt-0.5">Búsqueda Textual</div>
                <div className="text-[8.5px] text-amber-600/70 font-normal mt-0.5">Solo texto (sin coordenadas)</div>
              </div>
            </div>
          </div>

          <div className="space-y-3.5">
            {/* Data propia */}
            <Fuente titulo="AcopioVE (data propia)" nota="PostgreSQL · Estado: Activo" badge={`${m.coreAcopios + m.coreRefugios + m.coreSalud + m.coreTelefonos} fichas`} badgeCls="bg-violet-50 text-violet-700">
              <Celda n={m.coreAcopios} label="Acopios" cls="bg-violet-50/40 border-violet-100/50 text-violet-800" />
              <Celda n={m.coreRefugios} label="Refugios" cls="bg-teal-50/40 border-teal-100/50 text-teal-800" />
              <Celda n={m.coreSalud} label="Salud" cls="bg-cyan-50/40 border-cyan-100/50 text-cyan-800" />
              <Celda n={m.coreTelefonos} label="Teléfonos" cls="bg-slate-50/50 border-slate-100/50 text-slate-800" />
            </Fuente>

            <Fuente titulo="Venezuela Reporta" url="https://venezuelareporta.org" nota="API abierta · Estado: Activo" badge={`${m.vrSitios + m.vrPersonas} fichas`} badgeCls="bg-indigo-50 text-indigo-700">
              <Celda n={m.vrSitios} label="Sitios" cls="bg-indigo-50/40 border-indigo-100/50 text-indigo-800" />
              <Celda n={m.vrPersonas} label="Personas (al buscar)" cls="bg-slate-50/50 border-slate-100/50 text-slate-800" />
            </Fuente>

            <Fuente titulo="SOS Venezuela" url="https://sosvenezuela2026.com" nota="API REST JSON · Estado: Activo" badge={`${m.sosCount} registros`} badgeCls="bg-red-50 text-red-700">
              <Celda n={m.sosLocalizados} label="Localizados" cls="bg-emerald-50/40 border-emerald-100/50 text-emerald-800" />
              <Celda n={m.sosDesaparecidos} label="Desaparecidos" cls="bg-red-50/40 border-red-100/50 text-red-800" />
              <Celda n={m.sosWithPhoto} label="Con Foto" cls="bg-sky-50/40 border-sky-100/50 text-sky-800" />
            </Fuente>

            <Fuente titulo="Localizados VE & CIVIS" url="https://localizadosvenezuela.com" nota="API REST JSON · Estado: Activo" badge={`${m.locCount} registros`} badgeCls="bg-emerald-50 text-emerald-700">
              <Celda n={m.locLocalizados} label="Localizados VE" cls="bg-emerald-50/40 border-emerald-100/50 text-emerald-800" />
              <Celda n={m.locCivis} label="Hospitales CIVIS" cls="bg-sky-50/40 border-sky-100/50 text-sky-800" />
              <Celda n={m.locOpen} label="Abiertos/Verif." cls="bg-green-50/40 border-green-100/50 text-green-800" />
            </Fuente>

            <Fuente titulo="REDH AVAPRE" nota="API REST JSON · Estado: Activo" badge={`${m.redhCount} registros`} badgeCls="bg-orange-50 text-orange-700" />

            <Fuente titulo="Mapa de Daños (Edificios)" url="https://terremotovenezuela.com" nota="Supabase DB · Estado: Activo" badge={`${m.danosCount} reportes`} badgeCls="bg-pink-50 text-pink-700">
              <Celda n={m.danosTotal} label="Daño Total" cls="bg-rose-50/40 border-rose-100/50 text-rose-800" />
              <Celda n={m.danosEstructural} label="Daño Estructural" cls="bg-pink-50/40 border-pink-100/50 text-pink-850" />
            </Fuente>

            <Fuente titulo="Reporte VE" url="https://reporteve.org" nota="API REST JSON · Estado: Activo" badge={`${m.repCount} reportes`} badgeCls="bg-amber-50 text-amber-700">
              <Celda n={m.repCategories.electricity || 0} label="Luz" cls="bg-amber-50/40 border-amber-100/50 text-amber-800" />
              <Celda n={m.repCategories.water || 0} label="Agua" cls="bg-sky-50/40 border-sky-100/50 text-sky-800" />
              <Celda n={m.repCategories.medicine || 0} label="Salud" cls="bg-red-50/40 border-red-100/50 text-red-800" />
              <Celda n={m.repCategories.food || 0} label="Comida" cls="bg-lime-50/40 border-lime-100/50 text-lime-800" />
              <Celda n={m.repCategories.fuel || 0} label="Combustible" cls="bg-purple-50/40 border-purple-100/50 text-purple-800" />
              <Celda n={m.repCategories.telecoms || 0} label="Señal" cls="bg-teal-50/40 border-teal-100/50 text-teal-800" />
            </Fuente>

            <Fuente titulo="Venezuela Ayuda (Hub)" url="https://terremoto.hazlohoy.org" nota="API REST JSON · Estado: Activo" badge={`${m.hubCount} registros`} badgeCls="bg-cyan-50 text-cyan-700">
              <Celda n={m.hubDesaparecidos} label="Desap." cls="bg-red-50/40 border-red-100/50 text-red-800" />
              <Celda n={m.hubCheckins} label="A Salvo" cls="bg-emerald-50/40 border-emerald-100/50 text-emerald-800" />
              <Celda n={m.hubSolicitudes} label="Solicit." cls="bg-blue-50/40 border-blue-100/50 text-blue-800" />
              <Celda n={m.hubOfertas} label="Ofertas" cls="bg-cyan-50/40 border-cyan-100/50 text-cyan-800" />
            </Fuente>

            <Fuente titulo="Terremoto Venezuela" url="https://terremotovenezuela.app" nota="REST API · Estado: Activo" badge={`${m.ayudaVzlaCount} registros`} badgeCls="bg-green-50 text-green-700">
              <Celda n={m.ayudaVzlaIngresados} label="Hospitalizados" cls="bg-green-50/40 border-green-100/50 text-green-800" />
              <Celda n={m.ayudaVzlaAlta} label="Alta Médica" cls="bg-sky-50/40 border-sky-100/50 text-sky-800" />
            </Fuente>

            <Fuente titulo="De Mano en Mano" nota="Necesidades de insumos por unidad" badge={`${m.demanoCount} necesidades`} badgeCls="bg-teal-50 text-teal-700" />
            <Fuente titulo="Centros de Insumos" nota="Puntos de acopio de insumos y recursos" badge={`${m.insuCount} centros`} badgeCls="bg-purple-50 text-purple-700" />

            {customApi && (
              <Fuente titulo={customApi.nombre} nota="Cargada localmente (no se guarda en el servidor)" badge={`${customApi.total} registros`} badgeCls="bg-slate-100 text-slate-800" />
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-ap-border bg-ap-bg/20 flex justify-end">
          <button
            onClick={onClose}
            className="bg-ap-primary text-white text-[13px] font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function Fuente({
  titulo,
  url,
  nota,
  badge,
  badgeCls,
  children,
}: {
  titulo: string;
  url?: string;
  nota: string;
  badge: string;
  badgeCls: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border border-ap-border rounded-xl p-3.5 bg-ap-bg/35">
      <div className={`flex justify-between items-start ${children ? 'border-b border-ap-border/50 pb-1.5 mb-2' : ''}`}>
        <div className="flex flex-col min-w-0 pr-2">
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-extrabold text-[13px] text-ap-primary hover:text-ap-primary/80 transition-colors font-outfit underline truncate"
            >
              {titulo}
            </a>
          ) : (
            <span className="font-extrabold text-[13px] text-ap-primary font-outfit truncate">{titulo}</span>
          )}
          <span className="text-[9px] text-ap-muted font-mono mt-0.5">{nota}</span>
        </div>
        <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0 ${badgeCls}`}>{badge}</span>
      </div>
      {children && <div className="grid grid-cols-3 gap-2 text-center text-[10px]">{children}</div>}
    </div>
  );
}

function Celda({ n, label, cls }: { n: number; label: string; cls: string }) {
  return (
    <div className={`p-1.5 rounded-lg border ${cls}`}>
      <div className="font-bold">{n}</div>
      <div className="text-ap-muted">{label}</div>
    </div>
  );
}
