import { telegramConfig, setWebhook } from '../channels/telegram.js';
import { config } from '../config.js';

async function main(): Promise<void> {
  const cfg = telegramConfig();
  if (!cfg) throw new Error('TELEGRAM_BOT_TOKEN required');
  const base = config.webhookPublicUrl;
  if (!base) throw new Error('WEBHOOK_PUBLIC_URL required');
  const url = `${base.replace(/\/$/, '')}/webhooks/telegram`;
  const r = await setWebhook(cfg, url, config.telegram.webhookSecret || undefined);
  if (!r.ok) throw new Error(r.error || 'setWebhook failed');
  console.log(`Telegram webhook set to ${url}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
