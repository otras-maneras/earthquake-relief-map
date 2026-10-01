import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { verifyPassword, setSession } from '@/lib/auth';
import { blockedFor, hit, reset, clientIp } from '@/lib/ratelimit';

const MAX = 6;
const WINDOW = 15 * 60 * 1000; // 15 min
const BLOCK = 15 * 60 * 1000; // bloqueo 15 min tras superar el límite

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const email = parsed.data.email.toLowerCase().trim();
  const ip = clientIp(req);
  const ipKey = `login:ip:${ip}`;
  const emailKey = `login:email:${email}`;

  // Bloqueo por fuerza bruta (por IP o por email).
  const wait = Math.max(blockedFor(ipKey), blockedFor(emailKey));
  if (wait > 0) {
    return NextResponse.json(
      { error: `Demasiados intentos. Probá de nuevo en ${Math.ceil(wait / 60)} min.` },
      { status: 429 },
    );
  }

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user || !user.active || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    hit(ipKey, MAX, WINDOW, BLOCK);
    hit(emailKey, MAX, WINDOW, BLOCK);
    return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 });
  }

  // Éxito: limpiar contadores.
  reset(ipKey);
  reset(emailKey);
  await setSession({ id: user.id, email: user.email, role: user.role, name: user.name });
  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}
