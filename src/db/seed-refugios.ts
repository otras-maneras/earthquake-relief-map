import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { db } from './index';
import { centros } from './schema';

// Refugios habilitados en Caracas (fuente @svenezolanista).
// Solo los que geolocalizaron de forma razonable (nivel barrio/landmark).
// Coordenadas aproximadas: revisar/ajustar el pin en el panel admin si hace falta.
const FUENTE = '@svenezolanista';

const refugios: { name: string; address: string | null; lat: number; lng: number; ciudad: string }[] = [
  { name: 'Hotel Meliá Caracas', address: 'Sabana Grande, Caracas', lat: 10.49196, lng: -66.87781, ciudad: 'Caracas' },
  { name: 'Kabal Altamira', address: 'Altamira, Chacao', lat: 10.49559, lng: -66.84886, ciudad: 'Caracas' },
  { name: 'Estadio Chato Candela', address: '23 de Enero', lat: 10.50760, lng: -66.93120, ciudad: 'Caracas' },
  { name: 'Ipostel (Refugio)', address: 'Parroquia San Juan', lat: 10.49528, lng: -66.92353, ciudad: 'Caracas' },
  { name: 'U.E.N. Francisco Pimentel', address: 'Quinta Crespo', lat: 10.49690, lng: -66.91732, ciudad: 'Caracas' },
  { name: 'U.E.N. Gran Colombia', address: 'Av. Roosevelt, El Cementerio', lat: 10.47794, lng: -66.91429, ciudad: 'Caracas' },
  { name: 'Plaza Venezuela (Punto de apoyo)', address: 'Plaza Venezuela', lat: 10.49692, lng: -66.88574, ciudad: 'Caracas' },
  { name: 'Coliseo de Petare', address: 'Petare', lat: 10.47871, lng: -66.80722, ciudad: 'Caracas' },
  { name: 'Colegio Andrés Bello', address: 'La Candelaria', lat: 10.50135, lng: -66.90366, ciudad: 'Caracas' },
  { name: 'Complejo Cultural y Deportivo Guayana Esequiba', address: 'San Bernardino', lat: 10.51232, lng: -66.90214, ciudad: 'Caracas' },
  { name: 'Escuela Luis Alberto Hurtado', address: 'Km 12, El Junquito', lat: 10.46090, lng: -67.07894, ciudad: 'Caracas' },
];

async function main() {
  let inserted = 0;
  let skipped = 0;
  for (const r of refugios) {
    const exists = await db.query.centros.findFirst({
      where: and(eq(centros.name, r.name), eq(centros.tipo, 'refugio')),
    });
    if (exists) {
      console.log('ya existe, se omite:', r.name);
      skipped++;
      continue;
    }
    await db.insert(centros).values({
      name: r.name,
      address: r.address,
      latitude: String(r.lat),
      longitude: String(r.lng),
      tipo: 'refugio',
      estado: 'abierto',
      recibe: [],
      pais: 'Venezuela',
      ciudad: r.ciudad,
      fuente: FUENTE,
      active: true,
    });
    console.log('insertado:', r.name);
    inserted++;
  }
  console.log(`\nListo. Insertados: ${inserted} · Omitidos (ya existían): ${skipped}`);
  process.exit(0);
}

main().catch((e) => {
  console.error('Error en seed-refugios:', e);
  process.exit(1);
});
