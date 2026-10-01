import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, pool } from '../src/db/index';
import { users } from '../src/db/schema';

async function main() {
  const email = process.env.RESET_ADMIN_EMAIL || 'admin@centros-acopio.local';
  const password = process.argv[2];
  if (!password || password.length < 8) {
    console.error('Uso: npm run db:reset-admin -- <nueva-contraseña-min-8-caracteres>');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const updated = await db
    .update(users)
    .set({ passwordHash, active: true })
    .where(eq(users.email, email))
    .returning({ id: users.id, email: users.email, role: users.role });

  if (updated.length === 0) {
    console.error('No se encontró el usuario:', email);
    process.exit(1);
  }

  console.log('Contraseña actualizada para:', updated[0].email);
  console.log('Nueva contraseña:', password);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
