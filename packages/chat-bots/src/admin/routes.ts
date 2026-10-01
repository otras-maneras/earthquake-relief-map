import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import {
  listBroadcasts,
  getBroadcast,
  getBroadcastRecipients,
  createBroadcast,
  listContactLists,
  createContactList,
  listContacts,
  addContact,
  getContactsByListId,
} from '../db/campaigns.js';
import { kapsoConfig, listTemplates } from '../channels/kapso.js';
import { getInbound, listInbound } from '../db/inbound.js';

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!config.adminApiKey) {
    res.status(503).json({ error: 'ADMIN_API_KEY not configured' });
    return;
  }
  const key = req.header('x-admin-key') || req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (key !== config.adminApiKey) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
}

export function registerAdminRoutes(app: import('express').Express): void {
  app.use('/admin', requireAdmin);

  app.get('/admin/broadcasts', async (_req, res) => {
    const rows = await listBroadcasts();
    res.json({ data: rows });
  });

  app.get('/admin/broadcasts/:id', async (req, res) => {
    const b = await getBroadcast(req.params.id);
    if (!b) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const recipients = await getBroadcastRecipients(b.id);
    res.json({ data: b, recipients });
  });

  app.post('/admin/broadcasts', async (req, res) => {
    const body = req.body as {
      name?: string;
      type?: string;
      subject?: string;
      body?: string;
      templateName?: string;
      templateLang?: string;
      defaultVars?: string[];
      listId?: string;
      recipients?: Array<{ phone?: string; email?: string; name?: string; vars?: string[] }>;
    };

    if (!body.name || !body.type) {
      res.status(400).json({ error: 'name and type required' });
      return;
    }

    let recipients = body.recipients ?? [];
    if (body.listId) {
      const contacts = await getContactsByListId(body.listId);
      recipients = contacts.map((c) => ({
        phone: c.phone,
        email: c.email ?? undefined,
        name: c.name ?? undefined,
      }));
    }

    if (recipients.length === 0) {
      res.status(400).json({ error: 'recipients or listId required' });
      return;
    }

    if (body.type === 'whatsapp' && !body.templateName) {
      res.status(400).json({ error: 'templateName required for whatsapp campaigns' });
      return;
    }

    const broadcast = await createBroadcast({
      name: body.name,
      type: body.type,
      subject: body.subject,
      body: body.body,
      templateName: body.templateName,
      templateLang: body.templateLang,
      defaultVars: body.defaultVars,
      recipients,
    });

    res.status(201).json({ data: broadcast });
  });

  app.get('/admin/contact-lists', async (_req, res) => {
    res.json({ data: await listContactLists() });
  });

  app.post('/admin/contact-lists', async (req, res) => {
    const { name, description } = req.body as { name?: string; description?: string };
    if (!name) {
      res.status(400).json({ error: 'name required' });
      return;
    }
    res.status(201).json({ data: await createContactList(name, description) });
  });

  app.get('/admin/contact-lists/:id/contacts', async (req, res) => {
    res.json({ data: await listContacts(req.params.id) });
  });

  app.post('/admin/contact-lists/:id/contacts', async (req, res) => {
    const { phone, name, email } = req.body as { phone?: string; name?: string; email?: string };
    if (!phone) {
      res.status(400).json({ error: 'phone required' });
      return;
    }
    res.status(201).json({ data: await addContact(req.params.id, phone, name, email) });
  });

  app.get('/admin/templates', async (_req, res) => {
    const cfg = kapsoConfig();
    if (!cfg) {
      res.json({ data: [] });
      return;
    }
    const r = await listTemplates(cfg);
    res.json({ data: r.ok ? r.data?.data ?? [] : [] });
  });

  app.get('/admin/inbound', async (req, res) => {
    const limit = Math.min(200, Number(req.query.limit) || 50);
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const rows = await listInbound(limit, status);
    res.json({ data: rows });
  });

  app.get('/admin/inbound/:id', async (req, res) => {
    const row = await getInbound(req.params.id);
    if (!row) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json({ data: row });
  });
}
