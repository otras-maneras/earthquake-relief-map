import { NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/db';
import { broadcasts, broadcastRecipients } from '@/db/schema';
import { requireRole } from '@/lib/guard';

interface Ctx { params: Promise<{ id: string }> }

// GET: detalle de una campaña + sus destinatarios (para ver fallos/entregas).
export async function GET(_req: Request, { params }: Ctx) {
  const g = await requireRole('superadmin');
  if ('response' in g) return g.response;
  const s = g.session;
  const { id } = await params;

  const [bcast] = await db.select().from(broadcasts).where(eq(broadcasts.id, id));
  if (!bcast) return NextResponse.json({ error: 'No existe' }, { status: 404 });

  const recipients = await db
    .select({ phone: broadcastRecipients.phone, name: broadcastRecipients.name, status: broadcastRecipients.status, error: broadcastRecipients.error })
    .from(broadcastRecipients)
    .where(eq(broadcastRecipients.broadcastId, id))
    .orderBy(desc(broadcastRecipients.updatedAt))
    .limit(1000);

  return NextResponse.json({ ...bcast, recipients });
}
