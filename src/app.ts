import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { DB } from './db.js';
import { hash, session, transaction } from './db.js';
import { availableOrder, createQuote, decide, Fault, orderFor } from './domain.js';
import { normalizeImage } from './images.js';
import { cleanup, erase, queue } from './jobs.js';
import type { Provider } from './youcam.js';

const identifier = z.string().min(1).max(100);
const idempotency = z.string().min(8).max(100).regex(/^[a-zA-Z0-9_-]+$/);
export function createApp(db: DB, provider: Provider, options: { now?: () => number; limits?: { global: number; user: number }; demoGuestSessions?: boolean } = {}) {
  const now = options.now ?? Date.now;
  const limits = options.limits ?? { global: 20, user: 5 };
  const app = Fastify({ logger: false, bodyLimit: 8 * 1024 * 1024, requestTimeout: 30000 });
  app.decorateRequest('userId', '');
  app.addContentTypeParser(['image/jpeg', 'image/png'], { parseAs: 'buffer' }, (_req, body, done) => done(null, body));
  const rate = new Map<string, { count: number; until: number }>();
  const guestRate = new Map<string, { count: number; until: number }>();
  app.addHook('onRequest', async (req, reply) => {
    reply.header('Cache-Control', 'no-store').header('X-Content-Type-Options', 'nosniff');
    // Single-process local service: bounded IP limiter; no trust of forwarded IP headers.
    for (const [key, entry] of rate) if (entry.until <= now()) rate.delete(key);
    if (rate.size >= 10000 && !rate.has(req.ip)) throw new Fault(429, 'RATE_LIMITED');
    const bucket = rate.get(req.ip) ?? { count: 0, until: now() + 60000 };
    rate.set(req.ip, bucket);
    if (++bucket.count > 120) throw new Fault(429, 'RATE_LIMITED');
    if (['/health', '/', '/demo/app.js', '/demo/styles.css', '/demo/shopper.png', '/demo/blouse.png', '/demo/recorded-result.jpg', '/demo/results/v-neck.jpg', '/demo/results/round-neck.jpg', '/demo/results/collared.jpg'].includes(req.url.split('?')[0] ?? '')) return;
    if (req.method === 'POST' && req.url === '/demo/session' && options.demoGuestSessions) return;
    const token = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
    if (!token) throw new Fault(401, 'UNAUTHORIZED');
    const s = db.prepare('SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?').get(hash(token), now());
    if (!s) throw new Fault(401, 'UNAUTHORIZED');
    req.userId = s.user_id as string;
  });
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof z.ZodError) return reply.code(400).send({ error: 'INVALID_INPUT' });
    if (error instanceof Fault) return reply.code(error.status).send({ error: error.code });
    const status = (error as { statusCode?: number }).statusCode;
    return reply.code(status && status < 500 ? status : 500).send({ error: status && status < 500 ? 'INVALID_REQUEST' : 'INTERNAL_ERROR' });
  });
  app.get('/health', async () => ({ status: 'ok', commerce: 'SIMULATED', youcam: provider.enabled ? 'CONFIGURED_UNVERIFIED' : 'DISABLED', guestDemo: Boolean(options.demoGuestSessions) }));
  app.get('/', async (_req, reply) => reply.type('text/html; charset=utf-8').header('Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: https://yce-us.s3-accelerate.amazonaws.com https://yce-us.s3.amazonaws.com; connect-src 'self'; base-uri 'none'; form-action 'self'")
    .send(readFileSync(new URL('../web/index.html', import.meta.url))));
  app.get('/demo/app.js', async (_req, reply) => reply.type('application/javascript').send(readFileSync(new URL('../web/app.js', import.meta.url))));
  app.get('/demo/styles.css', async (_req, reply) => reply.type('text/css').send(readFileSync(new URL('../web/styles.css', import.meta.url))));
  app.get('/demo/shopper.png', async (_req, reply) => reply.type('image/png').send(readFileSync(new URL('../demo-assets/synthetic-shopper.png', import.meta.url))));
  app.get('/demo/blouse.png', async (_req, reply) => reply.type('image/png').send(readFileSync(new URL('../demo-assets/synthetic-blouse.png', import.meta.url))));
  app.get('/demo/recorded-result.jpg', async (_req, reply) => reply.type('image/jpeg').send(readFileSync(new URL('../demo-assets/youcam-result-1792439336399.jpg', import.meta.url))));
  const recordedResults: Record<string, string> = {
    'v-neck': 'youcam-result-1792439336399.jpg',
    'round-neck': 'youcam-result-1792459738608.jpg',
    'collared': 'youcam-result-1792459818444.jpg'
  };
  app.get('/demo/results/:id.jpg', async (req, reply) => {
    const { id } = z.object({ id: z.enum(['v-neck', 'round-neck', 'collared']) }).parse(req.params);
    return reply.type('image/jpeg').send(readFileSync(new URL(`../demo-assets/${recordedResults[id]}`, import.meta.url)));
  });
  if (options.demoGuestSessions) app.post('/demo/session', async (req, reply) => {
    for (const [key, entry] of guestRate) if (entry.until <= now()) guestRate.delete(key);
    const bucket = guestRate.get(req.ip) ?? { count: 0, until: now() + 3600000 };
    guestRate.set(req.ip, bucket);
    if (++bucket.count > 10) throw new Fault(429, 'DEMO_LIMIT');
    const active = db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id LIKE 'guest-%' AND expires_at>?").get(now())!.n as number;
    if (active >= 500) throw new Fault(429, 'DEMO_LIMIT');
    const product = db.prepare("SELECT id,price,currency FROM products WHERE id='original'").get() as { id: string; price: number; currency: string } | undefined;
    if (!product) throw new Fault(503, 'DEMO_NOT_SEEDED');
    const userId = `guest-${randomUUID()}`, orderId = `demo-${randomUUID()}`;
    const token = transaction(db, () => {
      db.prepare('INSERT INTO orders VALUES(?,?,?,?,?,?)').run(orderId, userId, product.id, product.price, product.currency, now() - 86400000);
      return session(db, userId, now());
    });
    return reply.code(201).send({ token, orderId, expiresAt: now() + 86400000, commerce: 'SIMULATED', providerCalls: false });
  });
  app.get('/v1/orders', async req => ({ data: db.prepare('SELECT * FROM orders WHERE user_id=?').all(req.userId), commerce: 'SIMULATED' }));
  app.get('/v1/orders/:id', async req => {
    const { id } = z.object({ id: identifier }).parse(req.params);
    return { data: orderFor(db, req.userId, id, now()), commerce: 'SIMULATED' };
  });
  app.get('/v1/orders/:id/candidates', async req => {
    const { id } = z.object({ id: identifier }).parse(req.params);
    const input = z.object({ reason: z.enum(['style', 'size', 'damaged', 'other']), size: z.string().max(20).optional(), neckline: z.string().max(30).optional(), maxExtra: z.coerce.number().int().min(0).max(1000000).default(1000000) }).strict().parse(req.query);
    const order = availableOrder(db, req.userId, id, now());
    if (input.reason !== 'style') return { data: [], fallback: 'STANDARD_RETURN', commerce: 'SIMULATED' };
    return { data: db.prepare(`SELECT id,name,size,neckline,price,currency,stock,version,image_id IS NOT NULL AS preview_available
      FROM products WHERE id!=? AND stock>0 AND currency=? AND price<=?
      AND (? IS NULL OR size=?) AND (? IS NULL OR neckline=?) ORDER BY (image_id IS NOT NULL) DESC, price,id LIMIT 3`)
      .all(order.product_id, order.currency, order.paid + input.maxExtra, input.size ?? null, input.size ?? null, input.neckline ?? null, input.neckline ?? null), commerce: 'SIMULATED' };
  });
  app.get('/v1/products/:id/image', async (req, reply) => {
    cleanup(db, now());
    const { id } = z.object({ id: identifier }).parse(req.params);
    const row = db.prepare(`SELECT a.bytes FROM products p JOIN assets a ON a.id=p.image_id
      WHERE p.id=? AND a.user_id='merchant' AND a.deleted=0 AND a.expires_at>?
      AND EXISTS(SELECT 1 FROM orders o WHERE o.user_id=? AND o.currency=p.currency
        AND o.delivered_at<=? AND ?<o.delivered_at+30*86400000
        AND (o.product_id=p.id OR p.stock>0))`).get(id, now(), req.userId, now(), now());
    if (!row?.bytes) throw new Fault(404, 'PRODUCT_IMAGE_NOT_FOUND');
    return reply.type('image/jpeg').send(Buffer.from(row.bytes as Uint8Array));
  });
  app.post('/v1/quotes', async (req, reply) => {
    const input = z.object({ orderId: identifier, productId: identifier, reason: z.literal('style') }).strict().parse(req.body);
    return reply.code(201).send({ data: createQuote(db, req.userId, input, now()), commerce: 'SIMULATED', reservation: false });
  });
  app.post('/v1/requests', async (req, reply) => {
    const input = z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('exchange'), orderId: identifier, quoteId: identifier }).strict(),
      z.object({ kind: z.literal('refund'), orderId: identifier }).strict()
    ]).parse(req.body);
    const idem = idempotency.parse(req.headers['idempotency-key']);
    return reply.code(201).send({ data: decide(db, req.userId, input, idem, now()), status: 'REQUESTED', commerce: 'SIMULATED', paymentExecuted: false, inventoryReserved: false });
  });
  app.get('/v1/requests', async req => ({ data: db.prepare('SELECT * FROM requests WHERE user_id=? ORDER BY created_at DESC').all(req.userId), commerce: 'SIMULATED' }));
  app.post('/v1/images', async (req, reply) => {
    if (req.userId.startsWith('guest-')) throw new Fault(403, 'GUEST_PREVIEW_DISABLED');
    if (req.headers['x-image-consent'] !== 'true') throw new Fault(400, 'CONSENT_REQUIRED');
    if (!Buffer.isBuffer(req.body)) throw new Fault(415, 'IMAGE_REQUIRED');
    cleanup(db, now());
    const n = db.prepare('SELECT COUNT(*) AS n FROM assets WHERE user_id=? AND deleted=0').get(req.userId)!.n as number;
    if (n >= 5) throw new Fault(429, 'IMAGE_LIMIT');
    const bytes = await normalizeImage(req.body);
    // Recheck after asynchronous decoding to prevent concurrent quota bypass.
    const count = db.prepare('SELECT COUNT(*) AS n FROM assets WHERE user_id=? AND deleted=0').get(req.userId)!.n as number;
    if (count >= 5) throw new Fault(429, 'IMAGE_LIMIT');
    const id = randomUUID(), expiry = now() + 3600000;
    db.prepare('INSERT INTO assets VALUES(?,?,?,?,0)').run(id, req.userId, bytes, expiry);
    return reply.code(201).send({ id, expiresAt: expiry, providerUpload: false });
  });
  app.delete('/v1/images/:id', async (req, reply) => {
    const { id } = z.object({ id: identifier }).parse(req.params);
    erase(db, req.userId, id); return reply.code(204).send();
  });
  app.post('/v1/previews', async (req, reply) => {
    if (req.userId.startsWith('guest-')) throw new Fault(403, 'GUEST_PREVIEW_DISABLED');
    const input = z.object({ quoteId: identifier, assetId: identifier, consent: z.literal(true) }).strict().parse(req.body);
    const idem = idempotency.parse(req.headers['idempotency-key']);
    const job = queue(db, provider, req.userId, input, idem, now(), limits);
    return reply.code(202).send({ id: job.id, state: job.state, provider: 'YouCam', appearanceOnly: true });
  });
  app.get('/v1/previews/:id', async req => {
    cleanup(db, now());
    const { id } = z.object({ id: identifier }).parse(req.params);
    const job = db.prepare('SELECT id,state,result_url,error,expires_at FROM jobs WHERE id=? AND user_id=?').get(id, req.userId);
    if (!job) throw new Fault(404, 'PREVIEW_NOT_FOUND');
    return { data: job, appearanceOnly: true, providerRetention: 'NOT_CONTROLLED_BY_RECONSIDER' };
  });
  return app;
}
declare module 'fastify' { interface FastifyRequest { userId: string } }
