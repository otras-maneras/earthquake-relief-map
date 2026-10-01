import express from 'express';
import { config, assertRuntimeConfig } from './config.js';
import { registerAdminRoutes } from './admin/routes.js';
import { kapsoWebhookGet, kapsoWebhookPost } from './webhooks/kapso.js';
import { telegramWebhookPost } from './webhooks/telegram.js';

assertRuntimeConfig();

const app = express();

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'chat-bots',
    whatsapp: Boolean(config.kapso.apiKey && config.kapso.phoneNumberId),
    telegram: Boolean(config.telegram.botToken),
    ingest: { autoReply: config.inbound.autoReplyEnabled, inboxApi: Boolean(config.inbox.apiUrl) },
  });
});

app.get('/webhooks/kapso', kapsoWebhookGet);

app.post(
  '/webhooks/kapso',
  express.raw({ type: '*/*' }),
  (req, res, next) => {
    const raw = req.body instanceof Buffer ? req.body.toString('utf8') : String(req.body ?? '');
    (req as express.Request & { rawBody?: string }).rawBody = raw;
    try {
      req.body = raw ? JSON.parse(raw) : {};
    } catch {
      req.body = {};
    }
    next();
  },
  (req, res) => {
    void kapsoWebhookPost(req, res);
  },
);

app.post('/webhooks/telegram', express.json(), (req, res) => {
  void telegramWebhookPost(req, res);
});

app.use(express.json());
registerAdminRoutes(app);

app.listen(config.port, () => {
  console.log(`[chat-bots] listening on :${config.port}`);
});
