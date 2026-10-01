import { z } from 'zod';

export const centroSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional().nullable(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  recibe: z.array(z.string().max(40)).max(20).optional().default([]),
  necesitaAhora: z.string().max(1000).optional().nullable(),
  horario: z.string().max(200).optional().nullable(),
  contacto: z.string().max(200).optional().nullable(),
  estado: z.enum(['abierto', 'lleno', 'cerrado']).optional().default('abierto'),
  tipo: z.enum(['acopio', 'refugio', 'alojamiento']).optional().default('acopio'),
  responsable: z.string().max(200).optional().nullable(),
  fuente: z.string().max(200).optional().nullable(),
  pais: z.string().max(80).optional().nullable(),
  ciudad: z.string().max(120).optional().nullable(),
});

// Sugerencia de la comunidad para complementar/corregir un centro YA publicado.
// Todos los campos del punto son opcionales (solo se propone lo que se quiere
// agregar/corregir), más una nota libre y datos de quien reporta.
export const sugerenciaSchema = z.object({
  name: z.string().max(200).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  recibe: z.array(z.string().max(40)).max(20).optional(),
  necesitaAhora: z.string().max(1000).optional().nullable(),
  horario: z.string().max(200).optional().nullable(),
  contacto: z.string().max(200).optional().nullable(),
  estado: z.enum(['abierto', 'lleno', 'cerrado']).optional(),
  pais: z.string().max(80).optional().nullable(),
  ciudad: z.string().max(120).optional().nullable(),
  // Metadatos del reporte
  mensaje: z.string().max(2000).optional().nullable(),
  contactoReporta: z.string().max(200).optional().nullable(),
  fuente: z.string().max(200).optional().nullable(),
  website: z.string().optional().nullable(), // honeypot anti-bot (debe venir vacío)
});

// Claves de `centros` que una sugerencia puede proponer (para fusionar).
export const SUGERENCIA_FIELDS = [
  'name', 'address', 'recibe', 'necesitaAhora', 'horario', 'contacto', 'estado', 'pais', 'ciudad',
] as const;

// Categorías de insumos que un centro puede recibir (para el formulario de carga).
export const RECIBE_OPCIONES = [
  'Agua',
  'Alimentos no perecederos',
  'Ropa',
  'Frazadas',
  'Medicamentos',
  'Higiene personal',
  'Pañales',
  'Artículos de bebé',
  'Herramientas',
] as const;

export const telefonoSchema = z.object({
  name: z.string().min(1).max(200),
  number: z.string().min(1).max(80),
  description: z.string().max(1000).optional().nullable(),
  pais: z.string().max(80).optional().nullable(),
  ciudad: z.string().max(120).optional().nullable(),
  active: z.boolean().optional().default(true),
});

