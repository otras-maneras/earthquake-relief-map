import { insertInbound } from '../db/inbound.js';
import { isBotHandledInbound, isMediaInbound, type NormalizedInbound } from './types.js';

function initialStatus(event: NormalizedInbound): string {
  if (isMediaInbound(event)) return 'received';
  if (isBotHandledInbound(event)) return 'routed_bot';
  return 'logged';
}

export type IngestResult = {
  ingested: number;
  mediaQueued: number;
  events: NormalizedInbound[];
};

export async function persistInboundEvents(events: NormalizedInbound[]): Promise<IngestResult> {
  let ingested = 0;
  let mediaQueued = 0;
  for (const event of events) {
    const { created } = await insertInbound(event, initialStatus(event));
    if (created) {
      ingested++;
      if (isMediaInbound(event)) mediaQueued++;
    }
  }
  return { ingested, mediaQueued, events };
}

export function shouldRunSearchBot(events: NormalizedInbound[]): boolean {
  if (events.length === 0) return false;
  // Si hay medios, el worker de ingesta responde; no ejecutar bot de búsqueda.
  if (events.some(isMediaInbound)) return false;
  return events.some(isBotHandledInbound);
}
