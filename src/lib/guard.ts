import { NextResponse } from 'next/server';
import { getSession, type Session } from '@/lib/auth';

// Guard reutilizable para route handlers. Devuelve la sesión o una respuesta
// ya formada (401/403) para cortar temprano:
//
//   const g = await requireRole('superadmin');
//   if ('response' in g) return g.response;
//   // ... usar g.session
//
type GuardResult = { session: Session } | { response: NextResponse };

export async function requireAuth(): Promise<GuardResult> {
  const session = await getSession();
  if (!session) return { response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) };
  return { session };
}

export async function requireRole(...roles: string[]): Promise<GuardResult> {
  const session = await getSession();
  if (!session) return { response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) };
  if (!roles.includes(session.role)) {
    return { response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) };
  }
  return { session };
}
