import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { createApp } from './app.js';
import { database, session } from './db.js';
import { normalizeImage } from './images.js';
import { Worker } from './jobs.js';
import { YouCam, storageURL } from './youcam.js';

// Isolated, one-attempt live integration exercise. No shopper credentials, provider URL,
// or API key are printed or saved. Synthetic inputs are expected.
// Match the server's TLS safeguard even when a developer shell has disabled verification.
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
if (process.env.LIVE_RENDER_APPROVED !== 'one') throw new Error('Set LIVE_RENDER_APPROVED=one for one explicitly authorized render.');
const key = process.env.YOUCAM_API_KEY;
if (!key) throw new Error('YOUCAM_API_KEY is missing from the local environment.');
const [garmentPath, shopperPath] = process.argv.slice(2);
if (!garmentPath || !shopperPath) throw new Error('Usage: npm run live:one -- <garment-image> <synthetic-shopper-image>');
const garment = await normalizeImage(readFileSync(garmentPath));
const shopper = await normalizeImage(readFileSync(shopperPath));

const startedAt = new Date().toISOString();
const db = database(':memory:');
const provider = new YouCam(key, true);
const app = createApp(db, provider, { limits: { global: 1, user: 1 } });
const worker = new Worker(db, provider);
let outcome: { state: string; error?: string; resultFile?: string } = { state: 'NOT_SUBMITTED' };
const json = (response: { statusCode: number; body: string }) => {
  const body = JSON.parse(response.body);
  if (response.statusCode >= 400) throw new Error(`Local API ${response.statusCode}: ${body.error ?? 'UNKNOWN'}`);
  return body;
};
try {
  const now = Date.now();
  db.prepare('INSERT INTO products(id,name,size,neckline,price,currency,stock) VALUES(?,?,?,?,?,?,?)')
    .run('original', 'Synthetic original blouse', 'M', 'high', 5000, 'USD', 1);
  const refId = randomUUID();
  db.prepare('INSERT INTO assets VALUES(?,?,?,?,0)').run(refId, 'merchant', garment, now + 3600000);
  db.prepare('INSERT INTO products(id,name,size,neckline,price,currency,stock,image_id) VALUES(?,?,?,?,?,?,?,?)')
    .run('v-neck', 'Synthetic blue V-neck blouse', 'M', 'v', 5500, 'USD', 1, refId);
  db.prepare('INSERT INTO orders VALUES(?,?,?,?,?,?)').run('one-live-order', 'synthetic-shopper', 'original', 5000, 'USD', now - 86400000);
  const token = session(db, 'synthetic-shopper', now);
  const headers = { authorization: `Bearer ${token}` };
  const quote = json(await app.inject({ method: 'POST', url: '/v1/quotes', headers,
    payload: { orderId: 'one-live-order', productId: 'v-neck', reason: 'style' } })).data;
  const upload = json(await app.inject({ method: 'POST', url: '/v1/images',
    headers: { ...headers, 'content-type': 'image/jpeg', 'x-image-consent': 'true' }, payload: shopper }));
  const queued = json(await app.inject({ method: 'POST', url: '/v1/previews',
    headers: { ...headers, 'idempotency-key': 'one-live-' + randomUUID() },
    payload: { quoteId: quote.id, assetId: upload.id, consent: true } }));
  outcome = { state: 'QUEUED' };
  console.log('One live preview queued. No additional preview will be submitted.');
  for (let attempt = 0; attempt <= 30; attempt++) {
    await worker.tick();
    const job = json(await app.inject({ url: `/v1/previews/${queued.id}`, headers })).data;
    outcome = { state: job.state, ...(job.error ? { error: job.error } : {}) };
    if (job.state === 'SUCCEEDED') {
      const url = storageURL(job.result_url);
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error('Provider result download failed.');
      const length = Number(response.headers.get('content-length') ?? 0);
      if (length > 12 * 1024 * 1024) throw new Error('Provider result too large.');
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 12 * 1024 * 1024) throw new Error('Provider result too large.');
      const result = await sharp(bytes, { limitInputPixels: 4096 * 4096 }).jpeg({ quality: 90 }).toBuffer();
      const path = `demo-assets/youcam-result-${Date.now()}.jpg`;
      writeFileSync(path, result);
      outcome.resultFile = path;
      break;
    }
    if (['FAILED', 'DELETED', 'EXPIRED'].includes(job.state)) break;
    if (attempt < 30) await new Promise(resolve => setTimeout(resolve, 10000));
  }
  console.log(`Live preview finished: ${outcome.state}${outcome.error ? ` (${outcome.error})` : ''}`);
  if (outcome.resultFile) console.log(`Result saved locally: ${outcome.resultFile}`);
} finally {
  const record = { startedAt, finishedAt: new Date().toISOString(), testInputs: 'SYNTHETIC',
    provider: 'YouCam Clothes V4', attemptsQueued: outcome.state === 'NOT_SUBMITTED' ? 0 : 1, ...outcome };
  writeFileSync(`evidence/live-run-${Date.now()}.json`, JSON.stringify(record, null, 2));
  await app.close();
  db.close();
}
