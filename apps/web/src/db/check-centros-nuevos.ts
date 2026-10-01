import 'dotenv/config';
import { db, pool } from './index';
import { centros } from './schema';
import { or, like, eq } from 'drizzle-orm';

async function main() {
  console.log('Buscando centros existentes...');
  const rows = await db
    .select()
    .from(centros)
    .where(
      or(
        like(centros.name, '%ULA%'),
        like(centros.name, '%Universidad de Los Andes%'),
        like(centros.ciudad, '%Mérida%'),
        like(centros.ciudad, '%Táchira%'),
        like(centros.ciudad, '%Bogotá%'),
        like(centros.ciudad, '%Tenerife%'),
        like(centros.ciudad, '%Montevideo%'),
        like(centros.ciudad, '%Panamá%'),
        like(centros.ciudad, '%Montalbán%'),
        like(centros.ciudad, '%Chacao%'),
        like(centros.address, '%Polanco%'),
        like(centros.name, '%Indio%')
      )
    );
  console.log('Encontrados:', rows.map(r => ({ id: r.id, name: r.name, ciudad: r.ciudad, address: r.address, fuente: r.fuente })));
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
