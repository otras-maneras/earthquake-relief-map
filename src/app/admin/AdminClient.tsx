'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Plus, Pencil, Trash2, LogOut, X, MapPin, Phone, Search } from 'lucide-react';
import { RECIBE_OPCIONES } from '@/lib/validation';
import { type Centro, ESTADO_COLOR, ESTADO_LABEL } from '@/lib/centros';
import { type Telefono } from '@/db/schema';

const MapPicker = dynamic(() => import('./MapPicker'), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center text-ap-muted text-sm">Cargando mapa…</div>,
});

type FormState = {
  id: string | null;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  recibe: string[];
  necesitaAhora: string;
  horario: string;
  contacto: string;
  estado: 'abierto' | 'lleno' | 'cerrado';
  tipo: 'acopio' | 'refugio' | 'alojamiento';
  responsable: string;
  fuente: string;
  pais: string;
  ciudad: string;
};

type TelefonoFormState = {
  id: string | null;
  name: string;
  number: string;
  description: string;
  pais: string;
  ciudad: string;
  active: boolean;
};

const emptyForm: FormState = {
  id: null, name: '', address: '', lat: null, lng: null, recibe: [],
  necesitaAhora: '', horario: '', contacto: '', estado: 'abierto', tipo: 'acopio', responsable: '', fuente: '', pais: '', ciudad: '',
};

const emptyTelefonoForm: TelefonoFormState = {
  id: null, name: '', number: '', description: '', pais: 'Venezuela', ciudad: 'Caracas', active: true
};

// Sugerencia de complemento de la comunidad sobre un centro ya publicado.
type Sugerencia = {
  s: {
    id: string;
    centroId: string;
    payload: Record<string, unknown>;
    mensaje: string | null;
    contactoReporta: string | null;
    fuente: string | null;
    createdAt: string;
  };
  centro: Centro;
};

const SUG_FIELD_LABEL: Record<string, string> = {
  name: 'Nombre', address: 'Dirección', recibe: 'Recibe', necesitaAhora: 'Necesita ahora',
  horario: 'Horario', contacto: 'Contacto', estado: 'Estado', pais: 'País', ciudad: 'Ciudad',
};

// Texto legible de un valor de centro/sugerencia (arrays y estado incluidos).
function sugValue(field: string, v: unknown): string {
  if (v === undefined || v === null || v === '') return '—';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  if (field === 'estado') return ESTADO_LABEL[String(v)] || String(v);
  return String(v);
}

export default function AdminClient({ user }: { user: { name: string; role: string } }) {
  const [tab, setTab] = useState<'centros' | 'telefonos'>('centros');
  const [centros, setCentros] = useState<Centro[]>([]);
  const [pending, setPending] = useState<Centro[]>([]);
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [telefonos, setTelefonos] = useState<Telefono[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [telefonoForm, setTelefonoForm] = useState<TelefonoFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Buscador + filtros de la lista de centros.
  const [query, setQuery] = useState('');
  const [fTipo, setFTipo] = useState<'todos' | 'acopio' | 'refugio' | 'alojamiento'>('todos');
  const [fEstado, setFEstado] = useState<'todos' | 'abierto' | 'lleno' | 'cerrado'>('todos');


  const load = () => {
    setLoading(true);
    // El admin esquiva la caché del GET público (s-maxage) para ver sus cambios al instante.
    fetch(`/api/centros?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setCentros(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  };
  const loadPending = () => {
    fetch('/api/centros/pending')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setPending(Array.isArray(d) ? d : []))
      .catch(() => {});
  };
  const loadTelefonos = () => {
    setLoading(true);
    fetch(`/api/telefonos?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setTelefonos(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  };
  const loadSugerencias = () => {
    fetch('/api/centros/sugerencias')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setSugerencias(Array.isArray(d) ? d : []))
      .catch(() => {});
  };
  useEffect(() => { load(); loadPending(); loadSugerencias(); loadTelefonos(); }, []);

  // KPIs (se calculan de lo que ya está cargado, sin endpoints nuevos).
  const stats = useMemo(() => {
    const byTipo = (t: string) => centros.filter((c) => (c.tipo || 'acopio') === t).length;
    const paises = new Set(centros.map((c) => (c.pais || '').trim()).filter(Boolean)).size;
    return {
      total: centros.length,
      acopios: byTipo('acopio'),
      refugios: byTipo('refugio'),
      alojamiento: byTipo('alojamiento'),
      paises,
      telefonos: telefonos.length,
    };
  }, [centros, telefonos]);

  // Lista filtrada por buscador + tipo + estado.
  const centrosFiltrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    return centros.filter((c) => {
      if (fTipo !== 'todos' && (c.tipo || 'acopio') !== fTipo) return false;
      if (fEstado !== 'todos' && c.estado !== fEstado) return false;
      if (q) {
        const hay = [c.name, c.address, c.ciudad, c.pais, c.responsable, c.fuente].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [centros, query, fTipo, fEstado]);

  const approve = async (c: Centro) => {
    const res = await fetch(`/api/centros/${c.id}/approve`, { method: 'POST' });
    if (res.ok) { loadPending(); load(); }
  };
  const reject = async (c: Centro) => {
    if (!confirm(`¿Rechazar "${c.name}"?`)) return;
    const res = await fetch(`/api/centros/${c.id}`, { method: 'DELETE' });
    if (res.ok) loadPending();
  };

  // Aplicar (fusión asistida): el backend mezcla el payload propuesto al centro.
  const applySugerencia = async (row: Sugerencia) => {
    const res = await fetch(`/api/centros/sugerencias/${row.s.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    });
    if (res.ok) { loadSugerencias(); load(); }
    else alert((await res.json().catch(() => ({})))?.error || 'No se pudo aplicar.');
  };
  const dismissSugerencia = async (row: Sugerencia) => {
    if (!confirm('¿Descartar esta sugerencia?')) return;
    const res = await fetch(`/api/centros/sugerencias/${row.s.id}`, { method: 'DELETE' });
    if (res.ok) loadSugerencias();
  };
  // Editar a mano: abre el formulario del centro con los valores propuestos ya
  // fusionados; el admin ajusta y guarda. Luego puede descartar la sugerencia.
  const editFromSugerencia = (row: Sugerencia) => {
    const p = row.s.payload || {};
    const has = (k: string) => Object.prototype.hasOwnProperty.call(p, k);
    const merged: Centro = {
      ...row.centro,
      ...(has('name') ? { name: String(p.name) } : {}),
      ...(has('address') ? { address: String(p.address) } : {}),
      ...(has('horario') ? { horario: String(p.horario) } : {}),
      ...(has('contacto') ? { contacto: String(p.contacto) } : {}),
      ...(has('necesitaAhora') ? { necesitaAhora: String(p.necesitaAhora) } : {}),
      ...(has('estado') ? { estado: p.estado as Centro['estado'] } : {}),
      ...(has('pais') ? { pais: String(p.pais) } : {}),
      ...(has('ciudad') ? { ciudad: String(p.ciudad) } : {}),
      ...(has('recibe') ? { recibe: Array.from(new Set([...(row.centro.recibe || []), ...(p.recibe as string[])])) } : {}),
    };
    openEdit(merged);
  };

  const openNew = () => { setError(''); setForm({ ...emptyForm }); };
  const openEdit = (c: Centro) => {
    setError('');
    setForm({
      id: c.id, name: c.name, address: c.address || '', lat: parseFloat(c.latitude), lng: parseFloat(c.longitude),
      recibe: c.recibe || [], necesitaAhora: c.necesitaAhora || '', horario: c.horario || '',
      contacto: c.contacto || '', estado: c.estado, tipo: c.tipo || 'acopio', responsable: c.responsable || '', fuente: c.fuente || '',
      pais: c.pais || '', ciudad: c.ciudad || '',
    });
  };

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) return setError('El nombre es obligatorio.');
    if (form.lat == null || form.lng == null) return setError('Fijá la ubicación en el mapa.');
    setSaving(true); setError('');
    const payload = {
      name: form.name.trim(), address: form.address.trim() || null,
      latitude: form.lat, longitude: form.lng, recibe: form.recibe,
      necesitaAhora: form.necesitaAhora.trim() || null, horario: form.horario.trim() || null,
      contacto: form.contacto.trim() || null, estado: form.estado, tipo: form.tipo, responsable: form.responsable.trim() || null,
      fuente: form.fuente.trim() || null,
      pais: form.pais.trim() || null, ciudad: form.ciudad.trim() || null,
    };
    const res = await fetch(form.id ? `/api/centros/${form.id}` : '/api/centros', {
      method: form.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      return setError(e.error || 'No se pudo guardar.');
    }
    setForm(null);
    load();
  };

  const del = async (c: Centro) => {
    if (!confirm(`¿Eliminar "${c.name}"?`)) return;
    const res = await fetch(`/api/centros/${c.id}`, { method: 'DELETE' });
    if (res.ok) load();
  };

  const openNewTelefono = () => { setError(''); setTelefonoForm({ ...emptyTelefonoForm }); };
  const openEditTelefono = (t: Telefono) => {
    setError('');
    setTelefonoForm({
      id: t.id,
      name: t.name,
      number: t.number,
      description: t.description || '',
      pais: t.pais || '',
      ciudad: t.ciudad || '',
      active: t.active,
    });
  };

  const saveTelefono = async () => {
    if (!telefonoForm) return;
    if (!telefonoForm.name.trim()) return setError('El nombre es obligatorio.');
    if (!telefonoForm.number.trim()) return setError('El número es obligatorio.');
    setSaving(true); setError('');
    const payload = {
      name: telefonoForm.name.trim(),
      number: telefonoForm.number.trim(),
      description: telefonoForm.description.trim() || null,
      pais: telefonoForm.pais.trim() || null,
      ciudad: telefonoForm.ciudad.trim() || null,
      active: telefonoForm.active,
    };
    const res = await fetch(telefonoForm.id ? `/api/telefonos/${telefonoForm.id}` : '/api/telefonos', {
      method: telefonoForm.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      return setError(e.error || 'No se pudo guardar.');
    }
    setTelefonoForm(null);
    loadTelefonos();
  };

  const delTelefono = async (t: Telefono) => {
    if (!confirm(`¿Eliminar teléfono "${t.name}"?`)) return;
    const res = await fetch(`/api/telefonos/${t.id}`, { method: 'DELETE' });
    if (res.ok) loadTelefonos();
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  };

  const toggleRecibe = (op: string) =>
    setForm((f) => (f ? { ...f, recibe: f.recibe.includes(op) ? f.recibe.filter((x) => x !== op) : [...f.recibe, op] } : f));


  return (
    <div className="min-h-[100dvh] bg-ap-bg font-sans">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-ap-surface border-b border-ap-border px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-extrabold text-ap-primary font-outfit text-[16px]">Panel · Centros de Acopio</h1>
          <p className="text-[12px] text-ap-muted">Hola, {user.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/admin/campanas" className="text-[12px] font-semibold text-ap-secondary hover:underline">Campañas</a>
          <a href="/acopio" className="text-[12px] font-semibold text-ap-secondary hover:underline">Ver mapa</a>
          <button onClick={logout} className="flex items-center gap-1.5 text-[12px] font-semibold text-ap-secondary border border-ap-border rounded-lg px-2.5 py-1.5 hover:bg-ap-surface-hover">
            <LogOut size={14} /> Salir
          </button>
        </div>
      </header>

      {/* Tabs Switcher */}
      <div className="max-w-[820px] mx-auto px-4 pt-4 flex gap-2">
        <button
          onClick={() => setTab('centros')}
          className={`px-4 py-2 rounded-lg text-[13px] font-bold border transition-colors ${
            tab === 'centros' ? 'bg-ap-primary text-white border-ap-primary' : 'bg-ap-surface border-ap-border text-ap-secondary hover:border-ap-muted'
          }`}
        >
          📍 Centros y Refugios
        </button>
        <button
          onClick={() => setTab('telefonos')}
          className={`px-4 py-2 rounded-lg text-[13px] font-bold border transition-colors ${
            tab === 'telefonos' ? 'bg-ap-primary text-white border-ap-primary' : 'bg-ap-surface border-ap-border text-ap-secondary hover:border-ap-muted'
          }`}
        >
          📞 Teléfonos de Emergencia
        </button>
      </div>

      <div className="max-w-[820px] mx-auto p-4">
        {tab === 'centros' ? (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
              <Kpi label="Centros" value={stats.total} />
              <Kpi label="Acopios" value={stats.acopios} />
              <Kpi label="Refugios" value={stats.refugios} />
              <Kpi label="Techo" value={stats.alojamiento} />
              <Kpi label="Países" value={stats.paises} />
              <Kpi label="Teléfonos" value={stats.telefonos} />
            </div>

            {pending.length > 0 && (
              <div className="mb-5 rounded-agentos-lg border border-ap-amber/40 bg-amber-50 p-3">
                <h2 className="font-bold text-ap-primary text-[14px] mb-2">Sugerencias pendientes de revisión ({pending.length})</h2>
                <div className="space-y-2">
                  {pending.map((c) => (
                    <div key={c.id} className="bg-white border border-ap-border rounded-lg p-3 flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-ap-primary text-[14px] truncate">
                          {c.name} <span className="text-[10px] font-bold text-ap-muted">· {c.tipo === 'refugio' ? 'Refugio' : c.tipo === 'alojamiento' ? 'Techo Solidario' : 'Acopio'}</span>
                        </div>
                        {c.address && <div className="text-[12px] text-ap-muted truncate">{c.address}</div>}
                        {(c.ciudad || c.pais) && <div className="text-[11px] text-ap-muted">{[c.ciudad, c.pais].filter(Boolean).join(', ')}</div>}
                        {c.recibe?.length > 0 && <div className="text-[11px] text-ap-secondary mt-0.5 truncate">Recibe: {c.recibe.join(', ')}</div>}
                        {c.necesitaAhora && <div className="text-[12px] font-semibold mt-0.5" style={{ color: '#b45309' }}>Necesita: {c.necesitaAhora}</div>}
                        {c.fuente && <div className="text-[10px] text-ap-muted mt-0.5">Fuente: {c.fuente}</div>}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button onClick={() => approve(c)} className="px-2.5 py-1 rounded-lg bg-ap-success text-white text-[11px] font-bold">Aprobar</button>
                        <button onClick={() => reject(c)} className="px-2.5 py-1 rounded-lg border border-ap-border text-ap-red text-[11px] font-bold hover:bg-red-50">Rechazar</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sugerencias.length > 0 && (
              <div className="mb-5 rounded-agentos-lg border border-ap-secondary/40 bg-blue-50 p-3">
                <h2 className="font-bold text-ap-primary text-[14px] mb-2">Sugerencias de complemento ({sugerencias.length})</h2>
                <div className="space-y-2">
                  {sugerencias.map((row) => {
                    const p = row.s.payload || {};
                    const keys = Object.keys(SUG_FIELD_LABEL).filter((k) => Object.prototype.hasOwnProperty.call(p, k));
                    return (
                      <div key={row.s.id} className="bg-white border border-ap-border rounded-lg p-3">
                        <div className="font-bold text-ap-primary text-[14px]">
                          {row.centro.name} <span className="text-[10px] font-bold text-ap-muted">· sugerencia para este punto</span>
                        </div>
                        {keys.length > 0 ? (
                          <div className="mt-2 space-y-1">
                            {keys.map((k) => (
                              <div key={k} className="text-[12px] flex flex-wrap gap-x-1.5">
                                <span className="font-bold text-ap-muted">{SUG_FIELD_LABEL[k]}:</span>
                                <span className="text-ap-muted line-through">{sugValue(k, (row.centro as unknown as Record<string, unknown>)[k])}</span>
                                <span className="text-ap-muted">→</span>
                                <span className="font-semibold text-ap-primary">{sugValue(k, p[k])}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[12px] text-ap-muted mt-1">Sin cambios de campos (solo mensaje).</div>
                        )}
                        {row.s.mensaje && <div className="text-[12px] text-ap-secondary mt-2 bg-ap-surface-hover rounded-lg px-2.5 py-1.5">“{row.s.mensaje}”</div>}
                        {(row.s.fuente || row.s.contactoReporta) && (
                          <div className="text-[10px] text-ap-muted mt-1">
                            Reporta: {[row.s.fuente, row.s.contactoReporta].filter(Boolean).join(' · ')}
                          </div>
                        )}
                        <div className="flex gap-1.5 mt-2.5">
                          <button onClick={() => applySugerencia(row)} disabled={keys.length === 0}
                            className="px-2.5 py-1 rounded-lg bg-ap-success text-white text-[11px] font-bold disabled:opacity-40">Aplicar</button>
                          <button onClick={() => editFromSugerencia(row)}
                            className="px-2.5 py-1 rounded-lg border border-ap-border text-ap-secondary text-[11px] font-bold hover:bg-ap-surface-hover">Editar a mano</button>
                          <button onClick={() => dismissSugerencia(row)}
                            className="px-2.5 py-1 rounded-lg border border-ap-border text-ap-red text-[11px] font-bold hover:bg-red-50">Descartar</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button onClick={openNew} className="mb-4 flex items-center gap-1.5 bg-ap-primary text-white rounded-lg px-4 py-2.5 text-[13px] font-bold hover:opacity-90">
              <Plus size={16} /> Nuevo centro
            </button>

            {/* Buscador + filtros */}
            <div className="mb-3 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ap-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nombre, ciudad, dirección, fuente…"
                  className="w-full pl-8 pr-8 py-2 rounded-lg border border-ap-border text-[13px] bg-ap-surface text-ap-primary outline-none focus:border-ap-secondary"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-ap-muted hover:text-ap-primary">
                    <X size={14} />
                  </button>
                )}
              </div>
              <select value={fTipo} onChange={(e) => setFTipo(e.target.value as typeof fTipo)} className="py-2 px-2.5 rounded-lg border border-ap-border text-[13px] bg-ap-surface text-ap-secondary outline-none focus:border-ap-secondary">
                <option value="todos">Todos los tipos</option>
                <option value="acopio">Acopio</option>
                <option value="refugio">Refugio</option>
                <option value="alojamiento">Techo solidario</option>
              </select>
              <select value={fEstado} onChange={(e) => setFEstado(e.target.value as typeof fEstado)} className="py-2 px-2.5 rounded-lg border border-ap-border text-[13px] bg-ap-surface text-ap-secondary outline-none focus:border-ap-secondary">
                <option value="todos">Todos los estados</option>
                <option value="abierto">Abierto</option>
                <option value="lleno">Lleno</option>
                <option value="cerrado">Cerrado</option>
              </select>
            </div>

            {loading && <div className="text-ap-muted text-sm">Cargando…</div>}
            {!loading && centros.length === 0 && <div className="text-ap-muted text-sm">Todavía no cargaste ningún centro.</div>}
            {!loading && centros.length > 0 && (
              <div className="text-[12px] text-ap-muted mb-2">
                Mostrando {centrosFiltrados.length} de {centros.length}
                {(query || fTipo !== 'todos' || fEstado !== 'todos') && (
                  <button onClick={() => { setQuery(''); setFTipo('todos'); setFEstado('todos'); }} className="ml-2 font-semibold text-ap-secondary hover:underline">Limpiar filtros</button>
                )}
              </div>
            )}
            {!loading && centros.length > 0 && centrosFiltrados.length === 0 && (
              <div className="text-ap-muted text-sm">Ningún centro coincide con la búsqueda.</div>
            )}

            <div className="space-y-2">
              {centrosFiltrados.map((c) => (
                <div key={c.id} className="bg-ap-surface border border-ap-border rounded-agentos-lg p-3 flex items-start gap-3">
                  <MapPin size={16} className="text-ap-muted mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ap-primary text-[14px] truncate">{c.name}</span>
                      <span className="shrink-0 text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full" style={{ background: ESTADO_COLOR[c.estado] }}>
                        {ESTADO_LABEL[c.estado]}
                      </span>
                    </div>
                    {c.address && <div className="text-[12px] text-ap-muted truncate">{c.address}</div>}
                    {c.recibe?.length > 0 && <div className="text-[11px] text-ap-secondary mt-0.5 truncate">Recibe: {c.recibe.join(', ')}</div>}
                    {c.necesitaAhora && <div className="text-[12px] font-semibold mt-0.5" style={{ color: '#b45309' }}>Necesita: {c.necesitaAhora}</div>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-ap-secondary hover:bg-ap-surface-hover"><Pencil size={15} /></button>
                    <button onClick={() => del(c)} className="p-1.5 rounded-lg text-ap-red hover:bg-red-50"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <button onClick={openNewTelefono} className="mb-4 flex items-center gap-1.5 bg-ap-primary text-white rounded-lg px-4 py-2.5 text-[13px] font-bold hover:opacity-90">
              <Plus size={16} /> Nuevo teléfono
            </button>

            {loading && <div className="text-ap-muted text-sm">Cargando…</div>}
            {!loading && telefonos.length === 0 && <div className="text-ap-muted text-sm">Todavía no cargaste ningún teléfono de emergencia.</div>}

            <div className="space-y-2">
              {telefonos.map((t) => (
                <div key={t.id} className="bg-ap-surface border border-ap-border rounded-agentos-lg p-3 flex items-start gap-3">
                  <Phone size={16} className="text-ap-muted mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-ap-primary text-[14px]">{t.name}</span>
                      <span className="font-mono text-ap-success text-[13px] font-bold">{t.number}</span>
                      {!t.active && (
                        <span className="shrink-0 text-[9px] font-bold text-white bg-ap-muted px-1.5 py-0.5 rounded-full">Inactivo</span>
                      )}
                    </div>
                    {t.description && <div className="text-[12px] text-ap-secondary mt-0.5">{t.description}</div>}
                    {(t.ciudad || t.pais) && (
                      <div className="text-[11px] text-ap-muted mt-0.5">
                        {[t.ciudad, t.pais].filter(Boolean).join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEditTelefono(t)} className="p-1.5 rounded-lg text-ap-secondary hover:bg-ap-surface-hover"><Pencil size={15} /></button>
                    <button onClick={() => delTelefono(t)} className="p-1.5 rounded-lg text-ap-red hover:bg-red-50"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal de formulario Centro */}
      {form && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-ap-surface w-full max-w-[560px] max-h-[94dvh] rounded-t-[20px] sm:rounded-agentos-lg border border-ap-border shadow-agentos-md flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-ap-border shrink-0">
              <h2 className="font-bold text-ap-primary font-outfit">{form.id ? 'Editar centro' : 'Nuevo centro'}</h2>
              <button onClick={() => setForm(null)} className="text-ap-muted p-1"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <Field label="Tipo">
                <div className="flex gap-1.5">
                  {(['acopio', 'refugio', 'alojamiento'] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setForm({ ...form, tipo: t })}
                      className={`flex-1 text-[11px] font-bold px-2 py-2 rounded-lg border ${form.tipo === t ? 'bg-ap-primary text-white border-ap-primary' : 'border-ap-border text-ap-secondary hover:border-ap-muted'}`}>
                      {t === 'acopio' ? 'Acopio' : t === 'refugio' ? 'Refugio' : 'Techo Solidario'}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Nombre *">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="inp" placeholder="Ej: Club Social Belgrano" />
              </Field>

              <Field label="Ubicación * (tocá el mapa o usá tu ubicación)">
                <div className="h-[240px] rounded-agentos-lg overflow-hidden border border-ap-border">
                  <MapPicker lat={form.lat} lng={form.lng} onChange={(lat, lng) => setForm({ ...form, lat, lng })} />
                </div>
                {form.lat != null && form.lng != null && (
                  <p className="text-[11px] text-ap-muted mt-1">📌 {form.lat.toFixed(5)}, {form.lng.toFixed(5)}</p>
                )}
              </Field>

              <Field label="Dirección (texto)">
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="inp" placeholder="Calle 1234, Barrio, Ciudad" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="País">
                  <input value={form.pais} onChange={(e) => setForm({ ...form, pais: e.target.value })} className="inp" placeholder="Venezuela" />
                </Field>
                <Field label="Ciudad">
                  <input value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} className="inp" placeholder="Caracas" />
                </Field>
              </div>

              <Field label="¿Qué recibe?">
                <div className="flex flex-wrap gap-1.5">
                  {RECIBE_OPCIONES.map((op) => {
                    const on = form.recibe.includes(op);
                    return (
                      <button key={op} type="button" onClick={() => toggleRecibe(op)}
                        className={`text-[12px] font-semibold px-2.5 py-1 rounded-full border ${on ? 'bg-ap-primary text-white border-ap-primary' : 'border-ap-border text-ap-secondary hover:border-ap-muted'}`}>
                        {op}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Necesita ahora (urgente)">
                <textarea value={form.necesitaAhora} onChange={(e) => setForm({ ...form, necesitaAhora: e.target.value })} className="inp resize-none" rows={2} placeholder="Ej: agua y pañales talle G" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Estado">
                  <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as FormState['estado'] })} className="inp">
                    <option value="abierto">Activo</option>
                    <option value="lleno">Lleno</option>
                    <option value="cerrado">Cerrado</option>
                  </select>
                </Field>
                <Field label="Horario">
                  <input value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} className="inp" placeholder="9 a 18 hs" />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Contacto">
                  <input value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} className="inp" placeholder="Teléfono / WhatsApp" />
                </Field>
                <Field label="Responsable">
                  <input value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} className="inp" placeholder="Nombre referente" />
                </Field>
              </div>

              <Field label="Fuente de la información">
                <input value={form.fuente} onChange={(e) => setForm({ ...form, fuente: e.target.value })} className="inp" placeholder="Ej: @Eldiario, @distritojabana" />
              </Field>

              {error && <p className="text-[12px] text-ap-red font-semibold">{error}</p>}
            </div>

            <div className="p-4 border-t border-ap-border shrink-0 flex gap-2">
              <button onClick={() => setForm(null)} className="flex-1 py-2.5 rounded-lg border border-ap-border text-ap-secondary font-bold text-[13px]">Cancelar</button>
              <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-lg bg-ap-primary text-white font-bold text-[13px] disabled:opacity-50">
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de formulario Teléfono */}
      {telefonoForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-ap-surface w-full max-w-[500px] max-h-[90dvh] rounded-t-[20px] sm:rounded-agentos-lg border border-ap-border shadow-agentos-md flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-ap-border shrink-0">
              <h2 className="font-bold text-ap-primary font-outfit">{telefonoForm.id ? 'Editar teléfono' : 'Nuevo teléfono'}</h2>
              <button onClick={() => setTelefonoForm(null)} className="text-ap-muted p-1"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <Field label="Nombre / Entidad *">
                <input value={telefonoForm.name} onChange={(e) => setTelefonoForm({ ...telefonoForm, name: e.target.value })} className="inp" placeholder="Ej: Bomberos Chacao" />
              </Field>

              <Field label="Número *">
                <input value={telefonoForm.number} onChange={(e) => setTelefonoForm({ ...telefonoForm, number: e.target.value })} className="inp" placeholder="Ej: (0212) 265-32-61 o 911" />
              </Field>

              <Field label="Descripción / Notas">
                <textarea value={telefonoForm.description} onChange={(e) => setTelefonoForm({ ...telefonoForm, description: e.target.value })} className="inp resize-none" rows={2} placeholder="Ej: Atención 24 horas" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="País">
                  <input value={telefonoForm.pais} onChange={(e) => setTelefonoForm({ ...telefonoForm, pais: e.target.value })} className="inp" placeholder="Venezuela" />
                </Field>
                <Field label="Ciudad">
                  <input value={telefonoForm.ciudad} onChange={(e) => setTelefonoForm({ ...telefonoForm, ciudad: e.target.value })} className="inp" placeholder="Caracas" />
                </Field>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="tel-active" checked={telefonoForm.active} onChange={(e) => setTelefonoForm({ ...telefonoForm, active: e.target.checked })} className="rounded text-ap-primary border-ap-border focus:ring-ap-secondary" />
                <label htmlFor="tel-active" className="text-[12px] font-bold text-ap-secondary select-none cursor-pointer">Visible en la web (Activo)</label>
              </div>

              {error && <p className="text-[12px] text-ap-red font-semibold">{error}</p>}
            </div>

            <div className="p-4 border-t border-ap-border shrink-0 flex gap-2">
              <button onClick={() => setTelefonoForm(null)} className="flex-1 py-2.5 rounded-lg border border-ap-border text-ap-secondary font-bold text-[13px]">Cancelar</button>
              <button onClick={saveTelefono} disabled={saving} className="flex-1 py-2.5 rounded-lg bg-ap-primary text-white font-bold text-[13px] disabled:opacity-50">
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .inp {
          width: 100%;
          padding: 9px 11px;
          border: 1px solid var(--ap-border);
          border-radius: 10px;
          font-size: 13px;
          background: #fff;
          color: var(--ap-primary);
          outline: none;
        }
        .inp:focus { border-color: var(--ap-secondary); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold text-ap-muted uppercase tracking-wide mb-1">{label}</span>
      {children}
    </label>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-ap-surface border border-ap-border rounded-agentos-lg px-2.5 py-2 text-center">
      <div className="text-[20px] font-extrabold text-ap-primary font-outfit leading-none">{value}</div>
      <div className="text-[10px] font-bold text-ap-muted uppercase tracking-wide mt-1">{label}</div>
    </div>
  );
}

