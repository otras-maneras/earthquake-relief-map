function requireEnv(name: string, value: string | undefined): string {
  if (!value?.trim()) throw new Error(`Missing required env: ${name}`);
  return value.trim();
}

function optionalUrl(name: string, value: string | undefined): string {
  if (!value?.trim()) return '';
  return value.trim().replace(/\/$/, '');
}

export const config = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL || '',
  adminApiKey: process.env.ADMIN_API_KEY || '',

  dataApiBaseUrl: optionalUrl('DATA_API_BASE_URL', process.env.DATA_API_BASE_URL),
  personasSearchPath: (process.env.PERSONAS_SEARCH_PATH ?? '/personas').trim(),

  botName: process.env.BOT_NAME?.trim() || 'Asistente de Emergencia',
  botSiteUrl: optionalUrl('BOT_SITE_URL', process.env.BOT_SITE_URL),
  botSearchUrl: optionalUrl('BOT_SEARCH_URL', process.env.BOT_SEARCH_URL),
  botWelcomeIntro:
    process.env.BOT_WELCOME_INTRO?.trim() ||
    'Te ayudo a obtener información en tiempo real sobre la emergencia.',
  botBrandedWelcome: process.env.BOT_BRANDED_WELCOME !== 'false',

  defaultPhoneCountry: (process.env.DEFAULT_PHONE_COUNTRY || '58').replace(/\D/g, ''),

  kapso: {
    apiKey: process.env.KAPSO_API_KEY?.trim() || '',
    phoneNumberId: process.env.KAPSO_PHONE_NUMBER_ID?.trim() || '',
    wabaId: process.env.KAPSO_WABA_ID?.trim() || '',
    webhookSecret: process.env.KAPSO_WEBHOOK_SECRET?.trim() || '',
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN?.trim() || '',
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || '',
  },

  webhookPublicUrl: optionalUrl('WEBHOOK_PUBLIC_URL', process.env.WEBHOOK_PUBLIC_URL),

  resend: {
    apiKey: process.env.RESEND_API_KEY?.trim() || '',
    fromName: process.env.RESEND_FROM_NAME?.trim() || 'Equipo de Emergencia',
    fromEmail: process.env.RESEND_FROM_EMAIL?.trim() || '',
  },

  inbound: {
    autoReplyEnabled: process.env.INBOUND_AUTO_REPLY !== 'false',
    autoReplyText:
      process.env.INBOUND_AUTO_REPLY_TEXT?.trim() ||
      'Recibimos tu mensaje. Referencia: {ref}. Lo revisaremos pronto.',
  },

  inbox: {
    apiUrl: optionalUrl('INBOX_API_URL', process.env.INBOX_API_URL),
    apiKey: process.env.INBOX_API_KEY?.trim() || '',
    apiKeyHeader: (process.env.INBOX_API_KEY_HEADER || 'X-Inbox-Key').trim(),
    forwardMultipart: process.env.INBOX_FORWARD_MULTIPART === 'true',
    forwardRequired: process.env.INBOX_FORWARD_REQUIRED === 'true',
  },
};

export function assertRuntimeConfig(): void {
  requireEnv('DATABASE_URL', config.databaseUrl);
  if (!config.dataApiBaseUrl) {
    throw new Error('DATA_API_BASE_URL is required');
  }
}

export function isPersonasSearchEnabled(): boolean {
  return Boolean(config.personasSearchPath);
}

export function mapUrl(): string {
  return config.botSiteUrl || 'https://example.org';
}

export function searchUrl(): string {
  return config.botSearchUrl || config.botSiteUrl || 'https://example.org';
}
