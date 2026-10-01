'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Megaphone, List, MessageSquare, Send, Clock, Plus, Trash2, Users,
  ChevronDown, Loader2, CheckCircle, XCircle, AlertTriangle, RefreshCw, ArrowLeft,
} from 'lucide-react';

type Tab = 'listas' | 'plantillas' | 'enviar' | 'historial';

interface ContactList { id: string; name: string; count: number; }
interface Contact {
  id: string; phone: string; name: string | null; source: string;
  firstName?: string | null; lastName?: string | null; email?: string | null;
  address?: string | null; organization?: string | null; city?: string | null;
  country?: string | null; notes?: string | null;
}
interface Template { name: string; language: string; status: string; category: string; body: string; varsCount: number; }
interface Broadcast { id: string; name: string; templateName: string; status: string; totalCount: number; sentCount: number; failCount: number; createdAt: string; }
interface Recipient { phone: string; name: string | null; status: string; error: string | null; }

const api = (url: string, init?: RequestInit) =>
  fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    APPROVED: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    PENDING: 'text-amber-700 bg-amber-50 border-amber-200',
    REJECTED: 'text-red-700 bg-red-50 border-red-200',
    done: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    sending: 'text-amber-700 bg-amber-50 border-amber-200',
    queued: 'text-ap-secondary bg-ap-bg border-ap-border',
  };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${map[status] || 'text-ap-muted bg-ap-bg border-ap-border'}`}>{status}</span>;
}

export default function CampanasClient() {
  const [tab, setTab] = useState<Tab>('listas');
  const [lists, setLists] = useState<ContactList[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const notify = (kind: 'ok' | 'err', msg: string) => { setToast({ kind, msg }); setTimeout(() => setToast(null), 4000); };

  const loadLists = useCallback(async () => {
    const r = await api('/api/admin/contact-lists');
    if (r.ok) setLists(await r.json());
  }, []);
  const loadTemplates = useCallback(async () => {
    const r = await api('/api/admin/wa-templates');
    if (r.ok) setTemplates(await r.json());
    else notify('err', (await r.json().catch(() => ({})))?.error || 'No se pudieron cargar las plantillas');
  }, []);
  const loadBroadcasts = useCallback(async () => {
    const r = await api('/api/admin/broadcasts');
    if (r.ok) setBroadcasts(await r.json());
  }, []);

  useEffect(() => { loadLists(); loadTemplates(); loadBroadcasts(); }, [loadLists, loadTemplates, loadBroadcasts]);

  // Auto-refresca el historial mientras haya campañas en envío.
  useEffect(() => {
    if (!broadcasts.some((b) => b.status === 'sending')) return;
    const t = setInterval(loadBroadcasts, 4000);
    return () => clearInterval(t);
  }, [broadcasts, loadBroadcasts]);

  const tabs: { id: Tab; label: string; icon: typeof List }[] = [
    { id: 'listas', label: 'Listas', icon: List },
    { id: 'plantillas', label: 'Plantillas', icon: MessageSquare },
    { id: 'enviar', label: 'Enviar', icon: Send },
    { id: 'historial', label: 'Historial', icon: Clock },
  ];

  return (
    <div className="min-h-[100dvh] bg-ap-bg font-sans">
      <header className="sticky top-0 z-20 bg-ap-surface border-b border-ap-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone size={18} className="text-ap-primary" />
          <h1 className="font-extrabold text-ap-primary font-outfit text-[16px]">Campañas de WhatsApp</h1>
        </div>
        <a href="/admin" className="flex items-center gap-1.5 text-[12px] font-semibold text-ap-secondary border border-ap-border rounded-lg px-2.5 py-1.5 hover:bg-ap-surface-hover">
          <ArrowLeft size={14} /> Panel
        </a>
      </header>

      {toast && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg text-[13px] font-semibold shadow-lg border ${toast.kind === 'ok' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          {toast.msg}
        </div>
      )}

      <div className="max-w-[860px] mx-auto px-4 pt-4 flex gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-[13px] font-bold border transition-colors whitespace-nowrap flex items-center gap-1.5 ${tab === t.id ? 'bg-ap-primary text-white border-ap-primary' : 'bg-ap-surface border-ap-border text-ap-secondary hover:border-ap-muted'}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      <main className="max-w-[860px] mx-auto px-4 py-6">
        {tab === 'listas' && <ListasTab lists={lists} reload={loadLists} notify={notify} />}
        {tab === 'plantillas' && <PlantillasTab templates={templates} reload={loadTemplates} notify={notify} />}
        {tab === 'enviar' && <EnviarTab lists={lists} templates={templates} notify={notify} onSent={() => { loadBroadcasts(); setTab('historial'); }} />}
        {tab === 'historial' && <HistorialTab broadcasts={broadcasts} reload={loadBroadcasts} />}
      </main>
    </div>
  );
}

// ==================== LISTAS ====================
function ListasTab({ lists, reload, notify }: { lists: ContactList[]; reload: () => void; notify: (k: 'ok' | 'err', m: string) => void }) {
  const [name, setName] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [bulk, setBulk] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    const r = await api('/api/admin/contact-lists', { method: 'POST', body: JSON.stringify({ name }) });
    if (r.ok) { setName(''); reload(); notify('ok', 'Lista creada'); } else notify('err', 'No se pudo crear');
  };
  const open = async (id: string) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id); setContacts([]); setBulk('');
    const r = await api(`/api/admin/contact-lists/${id}`);
    if (r.ok) setContacts((await r.json()).contacts);
  };
  const addBulk = async (id: string) => {
    if (!bulk.trim()) return;
    setBusy(true);
    const r = await api(`/api/admin/contact-lists/${id}/contacts`, { method: 'POST', body: JSON.stringify({ text: bulk }) });
    setBusy(false);
    if (r.ok) { const d = await r.json(); setBulk(''); open(id); reload(); notify('ok', `${d.added} agregados, ${d.skipped} omitidos`); }
  };
  const seed = async (id: string, source: string) => {
    setBusy(true);
    const r = await api(`/api/admin/contact-lists/${id}/seed`, { method: 'POST', body: JSON.stringify({ source }) });
    setBusy(false);
    if (r.ok) {
      const d = await r.json();
      open(id); reload();
      notify('ok', `${d.added} agregados desde ${source} · ${d.found} hallados, ${d.skippedNoPhone || 0} sin teléfono, ${d.skippedDup || 0} duplicados`);
    } else notify('err', 'No se pudo sembrar');
  };
  const delContact = async (listId: string, cid: string) => {
    await api(`/api/admin/contact-lists/${listId}/contacts?contactId=${cid}`, { method: 'DELETE' });
    setContacts((c) => c.filter((x) => x.id !== cid)); reload();
  };
  const delList = async (id: string) => {
    await api(`/api/admin/contact-lists/${id}`, { method: 'DELETE' });
    setOpenId(null); reload(); notify('ok', 'Lista eliminada');
  };

  return (
    <div className="space-y-5">
      <div className="bg-ap-surface border border-ap-border rounded-xl p-4 flex flex-col sm:flex-row gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nueva lista (ej: Centros Caracas)"
          className="flex-1 px-3 py-2 border border-ap-border rounded-lg text-sm bg-white text-ap-primary outline-none focus:border-ap-primary" />
        <button onClick={create} className="px-4 py-2 bg-ap-primary text-white rounded-lg text-[13px] font-bold flex items-center justify-center gap-1.5"><Plus size={14} /> Crear lista</button>
      </div>

      <div className="space-y-2">
        {lists.length === 0 && <p className="text-center text-ap-muted text-sm py-8">Todavía no hay listas.</p>}
        {lists.map((l) => (
          <div key={l.id} className="bg-ap-surface border border-ap-border rounded-xl overflow-hidden">
            <div className="p-4 flex items-center justify-between gap-3">
              <button onClick={() => open(l.id)} className="flex items-center gap-3 min-w-0 text-left">
                <span className="w-9 h-9 rounded-lg bg-ap-bg border border-ap-border flex items-center justify-center"><Users size={16} className="text-ap-secondary" /></span>
                <div className="min-w-0">
                  <div className="font-bold text-ap-primary text-[14px] truncate">{l.name}</div>
                  <div className="text-[12px] text-ap-muted">{l.count} contactos</div>
                </div>
              </button>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => open(l.id)} className="text-[12px] font-bold text-ap-secondary border border-ap-border rounded-lg px-2.5 py-1.5 hover:bg-ap-surface-hover flex items-center gap-1">Contactos <ChevronDown size={13} className={openId === l.id ? 'rotate-180 transition-transform' : 'transition-transform'} /></button>
                <button onClick={() => delList(l.id)} className="p-1.5 text-ap-muted hover:text-red-600 border border-ap-border rounded-lg" title="Eliminar lista"><Trash2 size={14} /></button>
              </div>
            </div>

            {openId === l.id && (
              <div className="border-t border-ap-border p-4 bg-ap-bg/30 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <span className="text-[11px] font-bold text-ap-muted uppercase self-center">Sembrar desde:</span>
                  {(['centros', 'voluntarios', 'telefonos'] as const).map((src) => (
                    <button key={src} disabled={busy} onClick={() => seed(l.id, src)}
                      className="text-[12px] font-bold text-ap-primary bg-white border border-ap-border rounded-lg px-2.5 py-1.5 hover:bg-ap-surface-hover disabled:opacity-50 capitalize">{src}</button>
                  ))}
                </div>
                <div>
                  <label className="text-[11px] font-bold text-ap-muted uppercase block mb-1">Agregar manual (telefono, nombre — uno por línea)</label>
                  <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={3} placeholder={'04141234567, Centro Chacao\n+58 412 555 1234, María'}
                    className="w-full px-3 py-2 border border-ap-border rounded-lg text-xs bg-white font-mono text-ap-primary outline-none focus:border-ap-primary" />
                  <button onClick={() => addBulk(l.id)} disabled={busy} className="mt-2 px-3 py-1.5 bg-ap-primary text-white rounded-lg text-xs font-bold disabled:opacity-50">{busy ? 'Agregando…' : 'Agregar a la lista'}</button>
                </div>
                <div className="max-h-[260px] overflow-y-auto divide-y divide-ap-border/50 border border-ap-border rounded-lg bg-white">
                  {contacts.length === 0 && <p className="text-[12px] text-ap-muted text-center py-4">Sin contactos.</p>}
                  {contacts.map((c) => (
                    <div key={c.id} className="flex items-start justify-between gap-2 px-3 py-2.5 text-[12.5px]">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-ap-primary">{c.name || c.organization || '—'}</span>
                          <span className="text-ap-secondary">+{c.phone}</span>
                          <span className="text-[10px] text-ap-muted bg-ap-bg border border-ap-border px-1.5 py-0.5 rounded capitalize">{c.source}</span>
                        </div>
                        {c.organization && c.organization !== c.name && <div className="text-[11.5px] text-ap-secondary mt-0.5">{c.organization}</div>}
                        {(c.city || c.country) && <div className="text-[11px] text-ap-muted mt-0.5">{[c.city, c.country].filter(Boolean).join(', ')}</div>}
                        {c.email && <div className="text-[11px] text-ap-muted mt-0.5">✉ {c.email}</div>}
                        {c.address && <div className="text-[11px] text-ap-muted mt-0.5 truncate">📍 {c.address}</div>}
                        {c.notes && <div className="text-[11px] text-ap-muted mt-0.5 line-clamp-2">{c.notes}</div>}
                      </div>
                      <button onClick={() => delContact(l.id, c.id)} className="text-ap-muted hover:text-red-600 shrink-0"><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== PLANTILLAS ====================
function PlantillasTab({ templates, reload, notify }: { templates: Template[]; reload: () => void; notify: (k: 'ok' | 'err', m: string) => void }) {
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<'UTILITY' | 'MARKETING'>('UTILITY');
  const [language, setLanguage] = useState('es');
  const [examples, setExamples] = useState('');
  const [busy, setBusy] = useState(false);

  const varCount = (body.match(/\{\{\s*\d+\s*\}\}/g) || []).reduce((set: Set<string>, m) => set.add(m), new Set<string>()).size;

  const create = async () => {
    if (!name.trim() || !body.trim()) return;
    setBusy(true);
    const r = await api('/api/admin/wa-templates', {
      method: 'POST',
      body: JSON.stringify({ name, body, category, language, examples: examples.split('|').map((s) => s.trim()).filter(Boolean) }),
    });
    setBusy(false);
    if (r.ok) { setName(''); setBody(''); setExamples(''); reload(); notify('ok', 'Plantilla enviada a aprobación de Meta'); }
    else notify('err', (await r.json().catch(() => ({})))?.error || 'No se pudo crear');
  };

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[12.5px] text-amber-900 flex gap-2">
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
        <span>Para escribir en frío (fuera de 24h), Meta exige plantillas <strong>aprobadas</strong>. Crea una acá, espera el estado <strong>APPROVED</strong> y luego úsala en “Enviar”. Usá <code className="bg-white px-1 rounded">{'{{1}}'}</code>, <code className="bg-white px-1 rounded">{'{{2}}'}</code>… para variables.</span>
      </div>

      <div className="bg-ap-surface border border-ap-border rounded-xl p-4 space-y-3">
        <div className="font-bold text-ap-primary text-[14px]">Nueva plantilla</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="nombre_interno (a-z, _)"
            className="px-3 py-2 border border-ap-border rounded-lg text-sm bg-white text-ap-primary outline-none focus:border-ap-primary" />
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="px-3 py-2 border border-ap-border rounded-lg text-sm bg-white text-ap-primary">
            <option value="es">Español (es)</option>
            <option value="en">Inglés (en)</option>
            <option value="es_VE">Español VE (es_VE)</option>
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value as 'UTILITY' | 'MARKETING')} className="px-3 py-2 border border-ap-border rounded-lg text-sm bg-white text-ap-primary">
            <option value="UTILITY">Utility (informativo)</option>
            <option value="MARKETING">Marketing</option>
          </select>
        </div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder={'Hola {{1}}, este es un aviso de AcopioVE sobre la coordinación de ayuda. {{2}}'}
          className="w-full px-3 py-2 border border-ap-border rounded-lg text-sm bg-white text-ap-primary outline-none focus:border-ap-primary" />
        {varCount > 0 && (
          <input value={examples} onChange={(e) => setExamples(e.target.value)} placeholder={`Ejemplos para las ${varCount} variable(s), separados por | (ej: María | Reunión a las 5pm)`}
            className="w-full px-3 py-2 border border-ap-border rounded-lg text-xs bg-white text-ap-primary outline-none focus:border-ap-primary" />
        )}
        <button onClick={create} disabled={busy} className="px-4 py-2 bg-ap-primary text-white rounded-lg text-[13px] font-bold disabled:opacity-50 flex items-center gap-1.5">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Crear y enviar a aprobación
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-bold text-ap-primary text-[14px]">Plantillas ({templates.length})</div>
          <button onClick={reload} className="text-[12px] text-ap-secondary flex items-center gap-1 hover:text-ap-primary"><RefreshCw size={13} /> Refrescar</button>
        </div>
        {templates.length === 0 && <p className="text-center text-ap-muted text-sm py-6">No hay plantillas todavía.</p>}
        {templates.map((t) => (
          <div key={`${t.name}_${t.language}`} className="bg-ap-surface border border-ap-border rounded-xl p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-ap-primary text-[13.5px]">{t.name} <span className="text-ap-muted font-normal">· {t.language} · {t.category}</span></span>
              <StatusBadge status={t.status} />
            </div>
            <p className="text-[13px] text-ap-secondary mt-1.5 whitespace-pre-wrap">{t.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== ENVIAR ====================
function EnviarTab({ lists, templates, notify, onSent }: { lists: ContactList[]; templates: Template[]; notify: (k: 'ok' | 'err', m: string) => void; onSent: () => void }) {
  const approved = useMemo(() => templates.filter((t) => t.status === 'APPROVED'), [templates]);
  const [name, setName] = useState('');
  const [tplKey, setTplKey] = useState('');
  const [vars, setVars] = useState<string[]>([]);
  const [selLists, setSelLists] = useState<string[]>([]);
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);

  const tpl = approved.find((t) => `${t.name}__${t.language}` === tplKey);

  // Solo al cambiar de plantilla (no en cada render) reinicia las variables.
  useEffect(() => {
    const t = approved.find((x) => `${x.name}__${x.language}` === tplKey);
    if (!t) { setVars([]); return; }
    setVars(Array.from({ length: t.varsCount }, (_, i) => (i === 0 ? '{nombre}' : '')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tplKey]);

  const estimate = useMemo(() => {
    const fromLists = lists.filter((l) => selLists.includes(l.id)).reduce((a, l) => a + l.count, 0);
    const fromManual = manual.split('\n').filter((x) => x.trim().length >= 8).length;
    return fromLists + fromManual;
  }, [selLists, manual, lists]);

  const send = async () => {
    if (!name.trim() || !tpl) { notify('err', 'Falta nombre o plantilla'); return; }
    if (estimate === 0) { notify('err', 'Elegí al menos una lista o números manuales'); return; }
    setBusy(true);
    const r = await api('/api/admin/broadcasts', {
      method: 'POST',
      body: JSON.stringify({ name, templateName: tpl.name, templateLang: tpl.language, listIds: selLists, manualText: manual, defaultVars: vars }),
    });
    setBusy(false);
    if (r.ok) { const d = await r.json(); notify('ok', `Campaña encolada: ${d.queued} destinatarios`); onSent(); }
    else notify('err', (await r.json().catch(() => ({})))?.error || 'No se pudo enviar');
  };

  return (
    <div className="space-y-4">
      {approved.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[12.5px] text-amber-900">
          No tenés plantillas <strong>aprobadas</strong> aún. Creá una en “Plantillas” y esperá el estado APPROVED.
        </div>
      )}
      <div className="bg-ap-surface border border-ap-border rounded-xl p-4 space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la campaña (ej: Aviso a centros — réplica)"
          className="w-full px-3 py-2 border border-ap-border rounded-lg text-sm bg-white text-ap-primary outline-none focus:border-ap-primary" />

        <select value={tplKey} onChange={(e) => setTplKey(e.target.value)} className="w-full px-3 py-2 border border-ap-border rounded-lg text-sm bg-white text-ap-primary">
          <option value="">Elegí una plantilla aprobada…</option>
          {approved.map((t) => <option key={`${t.name}__${t.language}`} value={`${t.name}__${t.language}`}>{t.name} ({t.language})</option>)}
        </select>

        {tpl && (
          <div className="bg-ap-bg/50 border border-ap-border rounded-lg p-3">
            <p className="text-[13px] text-ap-secondary whitespace-pre-wrap">{tpl.body}</p>
          </div>
        )}

        {vars.map((v, i) => (
          <div key={i}>
            <label className="text-[11px] font-bold text-ap-muted uppercase block mb-1">Variable {`{{${i + 1}}}`} {i === 0 && <span className="normal-case font-normal">— podés usar el token <code className="bg-white border border-ap-border px-1 rounded">{'{nombre}'}</code></span>}</label>
            <input value={v} onChange={(e) => setVars((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
              className="w-full px-3 py-2 border border-ap-border rounded-lg text-sm bg-white text-ap-primary outline-none focus:border-ap-primary" />
          </div>
        ))}
      </div>

      <div className="bg-ap-surface border border-ap-border rounded-xl p-4 space-y-3">
        <div className="text-[13px] font-bold text-ap-primary">Destinatarios</div>
        <div className="space-y-1.5">
          {lists.map((l) => (
            <label key={l.id} className="flex items-center gap-2 text-[13px] cursor-pointer">
              <input type="checkbox" checked={selLists.includes(l.id)} onChange={(e) => setSelLists((s) => e.target.checked ? [...s, l.id] : s.filter((x) => x !== l.id))} />
              <span className="text-ap-primary font-semibold">{l.name}</span>
              <span className="text-ap-muted">({l.count})</span>
            </label>
          ))}
          {lists.length === 0 && <p className="text-[12px] text-ap-muted">No hay listas. Creá una en “Listas”.</p>}
        </div>
        <div>
          <label className="text-[11px] font-bold text-ap-muted uppercase block mb-1">…o números manuales (telefono, nombre — uno por línea)</label>
          <textarea value={manual} onChange={(e) => setManual(e.target.value)} rows={2}
            className="w-full px-3 py-2 border border-ap-border rounded-lg text-xs bg-white font-mono text-ap-primary outline-none focus:border-ap-primary" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 bg-ap-surface border border-ap-border rounded-xl p-4">
        <span className="text-[13px] text-ap-secondary">Hasta <strong className="text-ap-primary">{estimate}</strong> destinatarios (se deduplican).</span>
        <button onClick={send} disabled={busy || !tpl || estimate === 0} className="px-5 py-2.5 bg-ap-primary text-white rounded-lg text-[13px] font-bold disabled:opacity-50 flex items-center gap-1.5">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar campaña
        </button>
      </div>
    </div>
  );
}

// ==================== HISTORIAL ====================
function HistorialTab({ broadcasts, reload }: { broadcasts: Broadcast[]; reload: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);

  const open = async (id: string) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id); setRecipients([]);
    const r = await api(`/api/admin/broadcasts/${id}`);
    if (r.ok) setRecipients((await r.json()).recipients);
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button onClick={reload} className="text-[12px] text-ap-secondary flex items-center gap-1 hover:text-ap-primary"><RefreshCw size={13} /> Refrescar</button>
      </div>
      {broadcasts.length === 0 && <p className="text-center text-ap-muted text-sm py-8">No hay campañas todavía.</p>}
      {broadcasts.map((b) => {
        const pct = b.totalCount ? Math.round(((b.sentCount + b.failCount) / b.totalCount) * 100) : 0;
        return (
          <div key={b.id} className="bg-ap-surface border border-ap-border rounded-xl overflow-hidden">
            <button onClick={() => open(b.id)} className="w-full p-4 text-left">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-ap-primary text-[14px]">{b.name}</span>
                <StatusBadge status={b.status} />
              </div>
              <div className="text-[12px] text-ap-muted mt-1">Plantilla: {b.templateName}</div>
              <div className="mt-2 h-1.5 bg-ap-bg rounded-full overflow-hidden">
                <div className="h-full bg-ap-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex gap-3 mt-1.5 text-[11.5px] font-semibold">
                <span className="text-emerald-700 flex items-center gap-1"><CheckCircle size={12} /> {b.sentCount}</span>
                <span className="text-red-600 flex items-center gap-1"><XCircle size={12} /> {b.failCount}</span>
                <span className="text-ap-muted">/ {b.totalCount}</span>
              </div>
            </button>
            {openId === b.id && (
              <div className="border-t border-ap-border max-h-[300px] overflow-y-auto divide-y divide-ap-border/50 bg-ap-bg/30">
                {recipients.map((r, i) => (
                  <div key={i} className="px-4 py-2 text-[12px] flex items-center justify-between gap-2">
                    <span className="text-ap-primary font-semibold truncate">{r.name || '—'} · +{r.phone}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${r.status === 'failed' ? 'text-red-700 bg-red-50 border-red-200' : r.status === 'sent' || r.status === 'delivered' || r.status === 'read' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-ap-muted bg-ap-bg border-ap-border'}`} title={r.error || ''}>{r.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
