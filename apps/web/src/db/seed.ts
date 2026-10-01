import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, pool } from './index';
import { users } from './schema';

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@centros-acopio.local';
  const password = process.env.SEED_ADMIN_PASSWORD || 'acopio2026';

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    console.log('Superadmin ya existe:', email);
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
    await db.insert(users).values({ email, passwordHash, name: 'Administrador', role: 'superadmin' });
    console.log('Superadmin creado:', email, '/', password);
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
