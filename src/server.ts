import { database } from './db.js';
import { createApp } from './app.js';
import { YouCam } from './youcam.js';
import { Worker } from './jobs.js';
import { z } from 'zod';

// Refuse insecure TLS inherited from a developer shell for provider traffic.
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
const limit = z.coerce.number().int().min(1).max(1000);
const db = database(process.env.DATABASE_PATH ?? './data/reconsider.sqlite');
const provider = new YouCam(process.env.YOUCAM_API_KEY ?? '', process.env.YOUCAM_ENABLED === 'true');
const host = process.env.HOST ?? '127.0.0.1';
const app = createApp(db, provider, { demoGuestSessions: host === '127.0.0.1' || process.env.DEMO_GUEST_SESSIONS === 'true', limits: {
  global: limit.parse(process.env.RENDER_DAILY_LIMIT ?? 20), user: limit.parse(process.env.RENDER_USER_DAILY_LIMIT ?? 5)
} });
const worker = new Worker(db, provider);
worker.recover();
const timer = setInterval(() => { void worker.tick().catch(() => console.error('Worker cycle failed; inspect local configuration.')); }, 1000);
timer.unref();
await app.listen({ port: z.coerce.number().int().min(1).max(65535).parse(process.env.PORT ?? 3100), host });
console.log('Reconsider API listening. Commerce uses demonstration data. See /health for provider configuration.');
async function stop() { clearInterval(timer); await app.close(); process.exit(0); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
