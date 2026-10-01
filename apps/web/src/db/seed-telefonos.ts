import 'dotenv/config';
import { db, pool } from './index';
import { telefonos } from './schema';

const data = [
  // --- Ambulancias y Emergencias Médicas ---
  { name: 'Emergencias CANTV', number: '171', description: 'Número general desde teléfono fijo CANTV', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Emergencias Movilnet', number: '*1', description: 'Número general desde Movilnet', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Emergencias Digitel', number: '112', description: 'Número general desde Digitel', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Emergencias Movistar', number: '911', description: 'Número general desde Movistar', pais: 'Venezuela', ciudad: 'Caracas' },

  { name: 'Aeroambulancias', number: '(0212) 993-25-41', description: 'Servicio de aeroambulancias', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Aeroambulancias', number: '(0212) 992-89-80', description: 'Servicio de aeroambulancias', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Aeroambulancias', number: '(0212) 992-89-90', description: 'Servicio de aeroambulancias', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Aeroambulancias', number: '(0212) 991-79-40', description: 'Servicio de aeroambulancias', pais: 'Venezuela', ciudad: 'Caracas' },

  { name: 'Rescarven', number: '(0212) 993-69-11', description: 'Emergencias médicas Rescarven', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Rescarven', number: '(0212) 993-69-91', description: 'Emergencias médicas Rescarven', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Rescarven', number: '(0212) 993-13-10', description: 'Emergencias médicas Rescarven', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Rescarven', number: '(0212) 993-33-67', description: 'Emergencias médicas Rescarven', pais: 'Venezuela', ciudad: 'Caracas' },

  { name: 'Servicio de Ambulancia Metropolitano', number: '(0212) 545-45-45', description: 'Servicio público de ambulancias', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Servicio de Ambulancia Metropolitano', number: '(0212) 545-46-55', description: 'Servicio público de ambulancias', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Servicio de Ambulancia Metropolitano', number: '(0212) 577-92-09', description: 'Servicio público de ambulancias', pais: 'Venezuela', ciudad: 'Caracas' },

  // --- Bomberos ---
  { name: 'Bomberos Antímano', number: '(0212) 472-20-54', description: 'Cuerpo de bomberos Antímano', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Bomberos Catia La Mar', number: '(0212) 351-99-66', description: 'Cuerpo de bomberos Catia La Mar', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Bomberos Chacao', number: '(0212) 265-32-61', description: 'Cuerpo de bomberos Chacao', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Bomberos del Este (Cafetal)', number: '(0212) 987-43-34', description: 'Cuerpo de bomberos Cafetal', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Bomberos del Este (Cafetal)', number: '(0212) 985-50-60', description: 'Cuerpo de bomberos Cafetal', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Bomberos Sucre', number: '(0212) 985-36-40', description: 'Cuerpo de bomberos Sucre', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Bomberos El Cafetal', number: '(0212) 985-36-40', description: 'Cuerpo de bomberos El Cafetal', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Bomberos El Cafetal', number: '(0212) 985-29-77', description: 'Cuerpo de bomberos El Cafetal', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Bomberos El Paraíso', number: '(0212) 481-09-61', description: 'Cuerpo de bomberos El Paraíso', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Bomberos El Valle', number: '(0212) 672-01-75', description: 'Cuerpo de bomberos El Valle', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Bomberos El Valle', number: '(0212) 672-06-36', description: 'Cuerpo de bomberos El Valle', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Bomberos La Guaira', number: '(0212) 332-76-20', description: 'Cuerpo de bomberos La Guaira', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Bomberos La Guaira', number: '(0212) 331-04-45', description: 'Cuerpo de bomberos La Guaira', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Bomberos La Trinidad', number: '(0212) 943-43-61', description: 'Cuerpo de bomberos La Trinidad', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Bomberos La Urbina', number: '(0212) 241-66-41', description: 'Cuerpo de bomberos La Urbina', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Bomberos Metropolitanos', number: '(0212) 545-45-45', description: 'Bomberos Metropolitanos de Caracas', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Bomberos Miranda', number: '(0212) 235-69-67', description: 'Cuerpo de bomberos Estado Miranda', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Bomberos Plaza Venezuela', number: '(0212) 793-00-39', description: 'Cuerpo de bomberos Plaza Venezuela', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Bomberos Plaza Venezuela', number: '(0212) 793-64-57', description: 'Cuerpo de bomberos Plaza Venezuela', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Bomberos San Bernardino', number: '(0212) 577-92-09', description: 'Cuerpo de bomberos San Bernardino', pais: 'Venezuela', ciudad: 'Caracas' },

  // --- Protección Civil ---
  { name: 'Protección Civil', number: '0800-5588427', description: 'Línea nacional de Protección Civil', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Protección Civil', number: '0800-2668446', description: 'Línea nacional de Protección Civil', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Protección Civil', number: '0800-2624368', description: 'Línea nacional de Protección Civil', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Instituto de Protección Civil', number: '(0212) 631-86-62', description: 'Oficina de Protección Civil', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Instituto de Protección Civil', number: '(0212) 631-90-58', description: 'Oficina de Protección Civil', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Instituto de Protección Civil', number: '(0212) 662-84-76', description: 'Oficina de Protección Civil', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Instituto de Protección Civil', number: '(0212) 662-32-05', description: 'Oficina de Protección Civil', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Instituto de Protección Civil', number: '(0212) 545-93-91', description: 'Oficina de Protección Civil', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Defensa Civil Alcaldía Mayor', number: '(0212) 662-67-59', description: 'Defensa Civil Alcaldía Mayor', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Defensa Civil Alcaldía Mayor', number: '(0212) 662-32-05', description: 'Defensa Civil Alcaldía Mayor', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Defensa Civil Nacional', number: '0800-28326', description: 'Defensa Civil Nacional', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Defensa Civil Nacional', number: '0800-24845', description: 'Defensa Civil Nacional', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Defensa Civil Nacional', number: '(0212) 483-98-05', description: 'Defensa Civil Nacional', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Defensa Civil Nacional', number: '(0212) 662-22-52', description: 'Defensa Civil Nacional', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Defensa Civil Nacional', number: '(0212) 662-66-19', description: 'Defensa Civil Nacional', pais: 'Venezuela', ciudad: 'Caracas' },

  // --- Policía ---
  { name: 'CICPC', number: '(0212) 571-35-33', description: 'Cuerpo de Investigaciones Científicas, Penales y Criminalísticas', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'CICPC', number: '(0212) 571-38-44', description: 'Cuerpo de Investigaciones Científicas, Penales y Criminalísticas', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'CICPC', number: '(0212) 571-32-66', description: 'Cuerpo de Investigaciones Científicas, Penales y Criminalísticas', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Policía Metropolitana', number: '(0212) 862-58-71', description: 'Policía Metropolitana de Caracas', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Policía Metropolitana', number: '(0212) 862-58-72', description: 'Policía Metropolitana de Caracas', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Policía Municipal de Chacao', number: '(0212) 264-12-56', description: 'PoliChacao', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Policía Municipal de Chacao', number: '(0212) 264-00-50', description: 'PoliChacao', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Policía Municipal de Baruta', number: '(0212) 943-28-55', description: 'PoliBaruta', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Policía Municipal de Baruta', number: '(0212) 943-62-77', description: 'PoliBaruta', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Policía Municipal de Sucre', number: '(0212) 242-21-11', description: 'PoliSucre', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Policía Municipal de Sucre', number: '(0212) 242-22-11', description: 'PoliSucre', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Policía Municipal de El Hatillo', number: '(0212) 961-16-82', description: 'PoliHatillo', pais: 'Venezuela', ciudad: 'Caracas' },

  // --- Rescate ---
  { name: 'Cuerpo de Emergencias, Rescate y Transmisiones', number: '(0212) 545-47-47', description: 'Rescate y transmisiones', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Grupo de Rescate Caracas (El Ávila)', number: '(0212) 615-63-86', description: 'Rescate en el cerro El Ávila / Parque Nacional Waraira Repano', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Grupo de Rescate Caracas (El Ávila)', number: '(0212) 415-46-61', description: 'Rescate en el cerro El Ávila / Parque Nacional Waraira Repano', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Grupo de Rescate Venezuela', number: '(0212) 977-47-10', description: 'Grupo de rescate voluntario', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Organización de Rescate Humboldt', number: '(0212) 234-22-34', description: 'Rescate Humboldt (ORH)', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Organización de Rescate Humboldt', number: '0414-926-21-39', description: 'Rescate Humboldt (ORH)', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Socorristas Cruz Roja', number: '(0212) 571-47-13', description: 'Cruz Roja Venezolana', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Inspectoría Nacional de Tránsito (INT)', number: '167', description: 'Tránsito terrestre', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'VIVEX (Vigilancia de Vías Expresas)', number: '(0212) 471-60-01', description: 'Vigilancia en autopistas de Caracas', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'VIVEX (Vigilancia de Vías Expresas)', number: '(0212) 471-14-81', description: 'Vigilancia en autopistas de Caracas', pais: 'Venezuela', ciudad: 'Caracas' },
  { name: 'Brigada de Restablecimiento de Vías y Atención de Emergencias (MTT)', number: '(0212) 537-26-77', description: 'Paramédicos de la autopista (Ángeles de la Autopista)', pais: 'Venezuela', ciudad: 'Caracas' },
];

async function main() {
  console.log('Limpiando base de datos de teléfonos...');
  await db.delete(telefonos);
  
  console.log('Sembrando teléfonos de emergencia individuales...');
  for (const item of data) {
    await db.insert(telefonos).values(item);
  }
  console.log('Sembrado finalizado con éxito.');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
