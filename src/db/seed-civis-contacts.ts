import 'dotenv/config';
import { db, pool } from './index';
import { contactLists, contacts } from './schema';

async function main() {
  console.log('Sembrando lista de Teléfonos de Emergencia de CIVIS...');

  // 1. Crear la lista
  const [list] = await db.insert(contactLists).values({
    name: 'CIVIS Teléfonos de Emergencia',
    description: 'Teléfonos de rescate, bomberos, ambulancias y organismos nacionales extraídos de CIVIS Venezuela',
  }).returning();

  console.log('Creada lista con ID:', list.id);

  // 2. Definir contactos
  const data = [
    { phone: '911', name: 'VEN 9-1-1 (Emergencias)', notes: 'Línea única nacional de emergencias en Venezuela' },
    { phone: '171', name: 'CANTV 171', notes: 'Línea de emergencia desde teléfonos fijos Cantv' },
    { phone: '*1', name: 'Movilnet / Movistar Emergencias (*1)', notes: 'Línea de emergencia para operadoras móviles Movilnet y Movistar' },
    { phone: '*911', name: 'Movilnet *911', notes: 'Línea de emergencia VEN 9-1-1 desde líneas Movilnet' },
    { phone: '112', name: 'Digitel Emergencias (112)', notes: 'Línea de emergencia desde líneas Digitel' },
    { phone: '*112', name: 'Digitel *112', notes: 'Línea de emergencia alternativa desde líneas Digitel' },
    
    // Ambulancias
    { phone: '02129932541', name: 'Aeroambulancias Principal', notes: 'Servicio de Aeroambulancias en Caracas. Teléfonos adicionales: (0212) 992.89.80, 992.89.90, 991.79.40' },
    { phone: '02129936911', name: 'Rescarven Ambulancias', notes: 'Servicio de ambulancias privadas Rescarven. Teléfonos adicionales: (0212) 993.69.91, 993.13.10, 993.33.67' },
    { phone: '02125454545', name: 'Ambulancia Clínico Metropolitano', notes: 'Ambulancias y atención de emergencias en Caracas. Teléfonos adicionales: (0212) 545.46.55, 577.92.09' },

    // Bomberos
    { phone: '02124722054', name: 'Bomberos Antímano', notes: 'Estación de bomberos en la parroquia Antímano, Caracas' },
    { phone: '02123519966', name: 'Bomberos Catia La Mar', notes: 'Estación de bomberos en Catia La Mar, Estado La Guaira' },
    { phone: '02122653261', name: 'Bomberos Chacao', notes: 'Estación de bomberos del Municipio Chacao, Miranda' },
    { phone: '02129874334', name: 'Bomberos del Este (Cafetal)', notes: 'Estación de bomberos en El Cafetal, Baruta. Teléfono adicional: (0212) 985.50.60' },
    { phone: '02129853640', name: 'Bomberos Sucre (El Cafetal)', notes: 'Estación de bomberos del Municipio Sucre. Teléfono adicional: (0212) 985.29.77' },
    { phone: '02124810961', name: 'Bomberos El Paraíso', notes: 'Estación de bomberos en El Paraíso, Caracas' },
    { phone: '02126720175', name: 'Bomberos El Valle', notes: 'Estación de bomberos en El Valle, Caracas. Teléfono adicional: (0212) 672.06.36' },
    { phone: '02123327620', name: 'Bomberos La Guaira', notes: 'Estación de bomberos en La Guaira (Vargas). Teléfono adicional: (0212) 331.04.45' },
    { phone: '02129434361', name: 'Bomberos La Trinidad', notes: 'Estación de bomberos en La Trinidad, Baruta' },
    { phone: '02122416641', name: 'Bomberos La Urbina', notes: 'Estación de bomberos en La Urbina, Municipio Sucre' },
    { phone: '02122356967', name: 'Bomberos Miranda', notes: 'Estación de bomberos de Protección Civil del Estado Miranda' },
    { phone: '02127930039', name: 'Bomberos Plaza Venezuela', notes: 'Estación de bomberos central en Plaza Venezuela. Teléfono adicional: (0212) 793.64.57' },
    { phone: '02125779209', name: 'Bomberos San Bernardino', notes: 'Estación de bomberos en San Bernardino, Caracas' },

    // Nacionales
    { phone: '02126318662', name: 'Protección Civil Nacional', notes: 'Sede principal de Protección Civil. Teléfonos adicionales: (0212) 662.84.76, 662.32.05' },
    { phone: '08008362567', name: 'Funvisis (0800-TEMBLOR)', notes: 'Línea directa para reporte y consulta de réplicas y eventos sísmicos en Venezuela' },
    { phone: '02125714380', name: 'Cruz Roja Venezolana Sede', notes: 'Sede Central de la Cruz Roja Venezolana en Caracas' }
  ];

  // 3. Insertar contactos
  for (const c of data) {
    await db.insert(contacts).values({
      listId: list.id,
      phone: c.phone,
      name: c.name,
      notes: c.notes,
      source: 'telefonos',
      country: 'Venezuela',
    });
  }

  console.log(`Sembrado finalizado. ${data.length} contactos de emergencia CIVIS agregados.`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
