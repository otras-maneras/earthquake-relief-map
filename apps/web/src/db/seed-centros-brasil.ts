import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { db } from './index';
import { centros } from './schema';

// Centros de acopio en Brasil (diáspora) — fuente @julietaosorior.
// Coords geocodificadas a nivel calle; la dirección exacta (con número) va en `address`.
const FUENTE = '@julietaosorior';

const data: { name: string; address: string; contacto: string; lat: number; lng: number; ciudad: string }[] = [
  { name: 'ONG Humanidade Mais Que Fronteiras', address: 'Rua João Pessoa, 2489, Nova Cidade', contacto: '+55 95 8103-2134', lat: 2.76701, lng: -60.73431, ciudad: 'Boa Vista' },
  { name: 'JR Acredita Soluções Educacionais', address: 'Rua Aruanã, 441, Santa Tereza', contacto: '+55 95 99175-8019 (WhatsApp/Tel)', lat: 2.83250, lng: -60.73362, ciudad: 'Boa Vista' },
  { name: 'ONG Hermandade Sem Fronteiras', address: 'Rua Carlos de Laet, 5225, Boqueirão', contacto: '+55 41 8813-0719', lat: -25.49344, lng: -49.23745, ciudad: 'Curitiba' },
  { name: 'ONG Casa Hispana', address: 'Av. Natalia Zarif, 60', contacto: '+55 11 96616-7972 (WhatsApp/Tel)', lat: -23.42846, lng: -46.49446, ciudad: 'Guarulhos' },
];

async function main() {
  let inserted = 0;
  let skipped = 0;
  for (const c of data) {
    const exists = await db.query.centros.findFirst({
      where: and(eq(centros.name, c.name), eq(centros.tipo, 'acopio')),
    });
    if (exists) {
      console.log('ya existe, se omite:', c.name);
      skipped++;
      continue;
    }
    await db.insert(centros).values({
      name: c.name,
      address: c.address,
      latitude: String(c.lat),
      longitude: String(c.lng),
      tipo: 'acopio',
      estado: 'abierto',
      recibe: [],
      contacto: c.contacto,
      pais: 'Brasil',
      ciudad: c.ciudad,
      fuente: FUENTE,
      active: true,
    });
    console.log('insertado:', c.name);
    inserted++;
  }
  console.log(`\nListo. Insertados: ${inserted} · Omitidos: ${skipped}`);
  process.exit(0);
}

main().catch((e) => {
  console.error('Error en seed-centros-brasil:', e);
  process.exit(1);
});
