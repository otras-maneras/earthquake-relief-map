import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb, numeric, integer, index } from 'drizzle-orm/pg-core';

// Usuarios del panel (superadmin gestiona; cargadores cargan centros).
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('cargador'), // 'superadmin' | 'cargador'
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// Centros de acopio.
export const centros = pgTable('centros', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  address: text('address'),
  latitude: numeric('latitude', { precision: 10, scale: 7 }).notNull(),
  longitude: numeric('longitude', { precision: 10, scale: 7 }).notNull(),
  // Qué recibe el centro (categorías): ['agua','alimentos','ropa','medicamentos','higiene',...]
  recibe: jsonb('recibe').notNull().default([]),
  necesitaAhora: text('necesita_ahora'), // necesidad urgente puntual del centro
  horario: varchar('horario', { length: 200 }),
  contacto: varchar('contacto', { length: 200 }),
  estado: varchar('estado', { length: 20 }).notNull().default('abierto'), // 'abierto' | 'lleno' | 'cerrado'
  tipo: varchar('tipo', { length: 20 }).notNull().default('acopio'), // 'acopio' | 'refugio'
  responsable: varchar('responsable', { length: 200 }),
  fuente: varchar('fuente', { length: 200 }), // fuente/atribución de la info (ej. @Eldiario)
  pais: varchar('pais', { length: 80 }),
  ciudad: varchar('ciudad', { length: 120 }),
  active: boolean('active').notNull().default(true),
  // Id del registro en un sistema externo que contribuyó este punto (ej. HelpMap).
  // Permite vincular sugerencias/ediciones a su origen y evitar duplicados en re-ingesta.
  externalId: varchar('external_id', { length: 120 }),
  // Verificación comunitaria: última confirmación pública ("sigue abierto") y su conteo.
  lastConfirmedAt: timestamp('last_confirmed_at'),
  confirmaciones: integer('confirmaciones').notNull().default(0),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => ({
  activeIdx: index('centros_active_idx').on(t.active),
  externalIdIdx: index('centros_external_id_idx').on(t.externalId),
}));

export type Centro = typeof centros.$inferSelect;
export type NewCentro = typeof centros.$inferInsert;
export type User = typeof users.$inferSelect;

// Sugerencias de la comunidad para COMPLEMENTAR/corregir un centro ya publicado.
// Distinto de un alta nueva (que entra como centro active=false): acá la persona
// propone datos sobre un punto que YA está en el mapa. Se revisan en el panel con
// el mismo patrón de aprobación y se fusionan al centro de origen.
export const centroSugerencias = pgTable('centro_sugerencias', {
  id: uuid('id').primaryKey().defaultRandom(),
  centroId: uuid('centro_id').notNull().references(() => centros.id, { onDelete: 'cascade' }),
  // Campos propuestos (solo los no vacíos), con las mismas claves que `centros`.
  payload: jsonb('payload').notNull().default({}),
  mensaje: text('mensaje'), // nota libre de quien reporta
  contactoReporta: varchar('contacto_reporta', { length: 200 }), // cómo ubicar a quien reporta
  fuente: varchar('fuente', { length: 200 }), // quién reporta (nombre/@cuenta)
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending|applied|rejected
  createdAt: timestamp('created_at').defaultNow(),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
}, (t) => ({
  centroIdx: index('centro_sugerencias_centro_idx').on(t.centroId),
  statusIdx: index('centro_sugerencias_status_idx').on(t.status),
}));

export type CentroSugerencia = typeof centroSugerencias.$inferSelect;

// Teléfonos de emergencia
export const telefonos = pgTable('telefonos', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  number: varchar('number', { length: 80 }).notNull(),
  description: text('description'),
  pais: varchar('pais', { length: 80 }),
  ciudad: varchar('ciudad', { length: 120 }),
  active: boolean('active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => ({
  activeIdx: index('telefonos_active_idx').on(t.active),
}));

export type Telefono = typeof telefonos.$inferSelect;
export type NewTelefono = typeof telefonos.$inferInsert;

// Copia de respaldo de la data de voluntarios intérpretes (fuente externa: Interp-Aid).
// Tabla de una sola fila por fuente: guarda el último snapshot exitoso en JSONB para
// servirlo como fallback si la API de terceros se cae. Entra en los backups a R2.
export const voluntariosSnapshot = pgTable('voluntarios_snapshot', {
  source: varchar('source', { length: 40 }).primaryKey(), // 'interp-aid'
  data: jsonb('data').notNull().default([]),
  count: integer('count').notNull().default(0),
  fetchedAt: timestamp('fetched_at').defaultNow(),
});

export type VoluntariosSnapshot = typeof voluntariosSnapshot.$inferSelect;

// ==================== Campañas de WhatsApp (Kapso) ====================
// Listas de contactos para coordinar entre sectores (centros, voluntarios, etc.).
export const contactLists = pgTable('contact_lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 160 }).notNull(),
  description: text('description'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
});

// Contactos dentro de una lista. `phone` se guarda normalizado (solo dígitos, con país).
export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  listId: uuid('list_id').notNull().references(() => contactLists.id, { onDelete: 'cascade' }),
  phone: varchar('phone', { length: 32 }).notNull(),
  name: varchar('name', { length: 200 }), // nombre para mostrar / razón social
  firstName: varchar('first_name', { length: 120 }), // nombre
  lastName: varchar('last_name', { length: 120 }), // apellido
  email: varchar('email', { length: 200 }), // correo
  address: text('address'), // dirección
  organization: varchar('organization', { length: 200 }), // centro/organización
  city: varchar('city', { length: 120 }),
  country: varchar('country', { length: 80 }),
  notes: text('notes'), // notas libres
  source: varchar('source', { length: 40 }).notNull().default('manual'), // manual|centros|voluntarios|telefonos
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  listIdx: index('contacts_list_idx').on(t.listId),
}));

// Plantillas de mensaje (espejo de las plantillas de Meta vía Kapso).
export const waTemplates = pgTable('wa_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 120 }).notNull(), // nombre Meta (snake_case)
  language: varchar('language', { length: 12 }).notNull().default('es'),
  category: varchar('category', { length: 20 }).notNull().default('UTILITY'), // UTILITY|MARKETING
  status: varchar('status', { length: 20 }).notNull().default('PENDING'), // PENDING|APPROVED|REJECTED
  body: text('body').notNull(), // texto con {{1}}, {{2}}...
  varsCount: integer('vars_count').notNull().default(0),
  metaTemplateId: varchar('meta_template_id', { length: 60 }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Campañas (difusiones) enviadas con una plantilla a una o más listas.
export const broadcasts = pgTable('broadcasts', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  type: varchar('type', { length: 20 }).notNull().default('whatsapp'), // 'whatsapp' | 'email'
  subject: varchar('subject', { length: 255 }),
  body: text('body'),
  templateName: varchar('template_name', { length: 120 }),
  templateLang: varchar('template_lang', { length: 12 }).default('es'),
  // Valores por defecto de las variables de la plantilla ({{1}}..). Por-contacto se
  // pueden resolver tokens como {nombre}. Guardado como array JSON.
  defaultVars: jsonb('default_vars').notNull().default([]),
  status: varchar('status', { length: 20 }).notNull().default('queued'), // queued|sending|done|canceled
  totalCount: integer('total_count').notNull().default(0),
  sentCount: integer('sent_count').notNull().default(0),
  failCount: integer('fail_count').notNull().default(0),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  finishedAt: timestamp('finished_at'),
}, (t) => ({
  statusIdx: index('broadcasts_status_idx').on(t.status),
}));

// Estado por destinatario de cada campaña (cola de envío + tracking de entrega).
export const broadcastRecipients = pgTable('broadcast_recipients', {
  id: uuid('id').primaryKey().defaultRandom(),
  broadcastId: uuid('broadcast_id').notNull().references(() => broadcasts.id, { onDelete: 'cascade' }),
  phone: varchar('phone', { length: 32 }),
  email: varchar('email', { length: 200 }),
  name: varchar('name', { length: 200 }),
  vars: jsonb('vars').notNull().default([]), // variables resueltas para este contacto
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending|sent|delivered|read|failed
  waMessageId: varchar('wa_message_id', { length: 80 }),
  error: text('error'),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => ({
  broadcastIdx: index('bcast_recipients_bcast_idx').on(t.broadcastId),
  statusIdx: index('bcast_recipients_status_idx').on(t.status),
}));

// Estado de conversación del bot entrante de WhatsApp (búsqueda de centros/refugios).
// Una fila por número. Guarda el último filtro elegido (tipo) para resolver la
// siguiente ubicación/ciudad, y el último msgId procesado para no responder doble
// ante reintentos del webhook de Meta. Efímera: se puede limpiar pasadas 24 h.
export const waSessions = pgTable('wa_sessions', {
  phone: varchar('phone', { length: 32 }).primaryKey(), // wa-id (solo dígitos, con país)
  tipo: varchar('tipo', { length: 20 }), // 'acopio' | 'refugio' | null (ambos)
  lastMsgId: varchar('last_msg_id', { length: 80 }), // idempotencia de webhook
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Estado de conversación del bot entrante de Telegram (mismo propósito que
// wa_sessions, tabla separada para no tocar el bot de WhatsApp en vivo).
export const telegramSessions = pgTable('telegram_sessions', {
  chatId: varchar('chat_id', { length: 32 }).primaryKey(),
  tipo: varchar('tipo', { length: 20 }),
  lastUpdateId: varchar('last_update_id', { length: 32 }),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type ContactList = typeof contactLists.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type WaTemplate = typeof waTemplates.$inferSelect;
export type Broadcast = typeof broadcasts.$inferSelect;
export type BroadcastRecipient = typeof broadcastRecipients.$inferSelect;
export type WaSession = typeof waSessions.$inferSelect;
export type TelegramSession = typeof telegramSessions.$inferSelect;

