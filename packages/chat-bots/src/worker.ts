import { assertRuntimeConfig } from './config.js';
import { runWorkerLoop } from './campaigns/worker.js';
import { runIngestWorkerLoop } from './ingest/worker.js';
import { closePool } from './db/pool.js';

assertRuntimeConfig();

const ac = new AbortController();
process.on('SIGINT', () => ac.abort());
process.on('SIGTERM', () => ac.abort());

Promise.all([runWorkerLoop(ac.signal), runIngestWorkerLoop(ac.signal)])
  .catch((e) => {
    console.error('[worker] fatal:', e);
    process.exitCode = 1;
  })
  .finally(() => closePool());
