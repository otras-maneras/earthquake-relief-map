import { NextResponse } from 'next/server';
import { db } from '@/db';
import { waTemplates } from '@/db/schema';
import { requireRole } from '@/lib/guard';
import { kapsoConfig, listTemplates, createTemplate, countVars, type MetaTemplate } from '@/lib/kapso';

// Extrae el texto del cuerpo de una plantilla de Meta.
function bodyOf(t: MetaTemplate): string {
  const comp = (t.components || []).find((c) => (c as { type?: string }).type === 'BODY') as { text?: string } | undefined;
  return comp?.text || '';
}

// GET: lista las plantillas reales desde Kapso (estado autoritativo: APPROVED/PENDING/REJECTED).
export async function GET() {
  const g = await requireRole('superadmin');
  if ('response' in g) return g.response;
  const s = g.session;

  const cfg = kapsoConfig();
  if (!cfg) return NextResponse.json({ error: 'Kapso no configurado' }, { status: 503 });

  const res = await listTemplates(cfg);
  if (!res.ok) return NextResponse.json({ error: res.error || 'Error al listar plantillas' }, { status: 502 });

  const items = (res.data?.data || []).map((t) => {
    const body = bodyOf(t);
    return { name: t.name, language: t.language, status: t.status, category: t.category, body, varsCount: countVars(body) };
  });
  return NextResponse.json(items);
}

// POST: crea una plantilla y la envía a aprobación de Meta. Guarda copia local.
export async function POST(req: Request) {
  const g = await requireRole('superadmin');
  if ('response' in g) return g.response;
  const s = g.session;

  const cfg = kapsoConfig();
  if (!cfg) return NextResponse.json({ error: 'Kapso no configurado' }, { status: 503 });

  const b = await req.json().catch(() => null);
  const name = (b?.name || '').toString().trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const language = (b?.language || 'es').toString();
  const category = b?.category === 'MARKETING' ? 'MARKETING' : 'UTILITY';
  const body = (b?.body || '').toString().trim();
  const examples: string[] = Array.isArray(b?.examples) ? b.examples.map((x: unknown) => String(x)) : [];

  if (!name || !body) return NextResponse.json({ error: 'Nombre y cuerpo son obligatorios' }, { status: 400 });

  const res = await createTemplate(cfg, { name, language, category, body, examples });
  if (!res.ok) return NextResponse.json({ error: res.error || 'Meta rechazó la creación' }, { status: 502 });

  const [row] = await db
    .insert(waTemplates)
    .values({
      name,
      language,
      category,
      status: (res.data?.status || 'PENDING').toString().toUpperCase(),
      body,
      varsCount: countVars(body),
      metaTemplateId: res.data?.id?.toString() || null,
      createdBy: s.id,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
