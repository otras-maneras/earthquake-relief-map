import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

// Fail-fast: en producción exigimos un JWT_SECRET real. Si falta, abortamos en
// vez de firmar tokens con un secreto público (que permitiría falsificar sesiones).
// En desarrollo local seguimos permitiendo un fallback para no frenar `npm run dev`.
function resolveSecret(): string {
  const s = process.env.JWT_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET no está definido en producción. Abortando para no usar un secreto inseguro.');
  }
  return 'dev-secret-change-me-please';
}

const secret = new TextEncoder().encode(resolveSecret());
const COOKIE = 'token';

export interface Session {
  id: string;
  email: string;
  role: string; // 'superadmin' | 'cargador'
  name: string;
}

export function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}
export function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function signToken(s: Session) {
  return new SignJWT({ email: s.email, role: s.role, name: s.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(s.id)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifyToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      id: String(payload.sub),
      email: String(payload.email ?? ''),
      role: String(payload.role ?? ''),
      name: String(payload.name ?? ''),
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function setSession(s: Session) {
  const token = await signToken(s);
  const c = await cookies();
  c.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const c = await cookies();
  c.delete(COOKIE);
}
