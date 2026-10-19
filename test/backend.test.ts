import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { database, session } from '../src/db.js';
import { createApp } from '../src/app.js';
import { Worker } from '../src/jobs.js';
import type { Provider } from '../src/youcam.js';

function fixture(enabled = false) {
  let time = 1800000000000;
  const db = database();
  const token = session(db, 'alice', time), other = session(db, 'bob', time);
  db.prepare('INSERT INTO products(id,name,size,neckline,price,currency,stock) VALUES(?,?,?,?,?,?,?)').run('old', 'Old', 'M', 'high', 5000, 'USD', 1);
  db.prepare('INSERT INTO products(id,name,size,neckline,price,currency,stock) VALUES(?,?,?,?,?,?,?)').run('new', 'New', 'M', 'v', 5500, 'USD', 1);
  db.prepare('INSERT INTO orders VALUES(?,?,?,?,?,?)').run('oa', 'alice', 'old', 5000, 'USD', time - 86400000);
  db.prepare('INSERT INTO orders VALUES(?,?,?,?,?,?)').run('ob', 'bob', 'old', 5000, 'USD', time - 86400000);
  const provider: Provider = { enabled, upload: async () => 'file', create: async () => 'task', poll: async () => ({ state: 'success', url: 'https://yce-us.s3-accelerate.amazonaws.com/result.jpg' }) };
  const app = createApp(db, provider, { now: () => time, limits: { global: 2, user: 2 } });
  const headers = { authorization: `Bearer ${token}` };
  const worker = new Worker(db, provider, () => time);
  const quote = async () => {
    const response = await app.inject({ method: 'POST', url: '/v1/quotes', headers, payload: { orderId: 'oa', productId: 'new', reason: 'style' } });
    assert.equal(response.statusCode, 201, response.body);
    return response.json().data;
  };
  const assets = () => {
    db.prepare('INSERT INTO assets VALUES(?,?,?,?,0)').run('self', 'alice', Buffer.from('test-fixture'), time + 3600000);
    db.prepare('INSERT INTO assets VALUES(?,?,?,?,0)').run('ref', 'merchant', Buffer.from('test-fixture'), time + 3600000);
    db.prepare("UPDATE products SET image_id='ref' WHERE id='new'").run();
  };
  const preview = (quoteId: string, key = 'preview-001') => app.inject({ method: 'POST', url: '/v1/previews', headers: { ...headers, 'idempotency-key': key }, payload: { quoteId, assetId: 'self', consent: true } });
  return { db, app, provider, worker, headers, other, quote, assets, preview, advance: (ms: number) => { time += ms; }, close: async () => { await app.close(); db.close(); } };
}

test('authentication, ownership, and expiry fail closed', async () => {
  const f = fixture();
  try {
    assert.equal((await f.app.inject('/v1/orders')).statusCode, 401);
    assert.equal((await f.app.inject({ url: '/v1/orders/ob', headers: f.headers })).statusCode, 404);
    f.advance(86400000);
    assert.equal((await f.app.inject({ url: '/v1/orders', headers: f.headers })).statusCode, 401);
  } finally { await f.close(); }
});
test('quote ignores no client money: extra monetary fields rejected; server computes difference', async () => {
  const f = fixture();
  try {
    const r = await f.app.inject({ method: 'POST', url: '/v1/quotes', headers: f.headers, payload: { orderId: 'oa', productId: 'new', reason: 'style', difference: -9999 } });
    assert.equal(r.statusCode, 400);
    assert.equal((await f.quote()).difference, 500);
  } finally { await f.close(); }
});
test('stock changes and price changes invalidate quotes before approval', async () => {
  const f = fixture();
  try {
    const q = await f.quote();
    f.db.prepare("UPDATE products SET stock=0 WHERE id='new'").run();
    const request = () => f.app.inject({ method: 'POST', url: '/v1/requests', headers: { ...f.headers, 'idempotency-key': 'decision-001' }, payload: { kind: 'exchange', orderId: 'oa', quoteId: q.id } });
    assert.equal((await request()).json().error, 'QUOTE_STALE');
    f.db.prepare("UPDATE products SET stock=1,price=5501 WHERE id='new'").run();
    assert.equal((await request()).json().error, 'QUOTE_STALE');
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM requests').get()!.n, 0);
  } finally { await f.close(); }
});
test('concurrent duplicate confirmations persist exactly one request and conflicting replay fails', async () => {
  const f = fixture();
  try {
    const q = await f.quote();
    const send = (key: string) => f.app.inject({ method: 'POST', url: '/v1/requests', headers: { ...f.headers, 'idempotency-key': key }, payload: { kind: 'exchange', orderId: 'oa', quoteId: q.id } });
    const results = await Promise.all([send('decision-001'), send('decision-001'), send('decision-002')]);
    assert.deepEqual(results.map(r => r.statusCode).sort(), [201, 201, 409]);
    assert.equal(results[0]!.json().data.id, results[1]!.json().data.id);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM requests').get()!.n, 1);
    assert.equal(results[0]!.json().paymentExecuted, false);
    const conflict = await f.app.inject({ method: 'POST', url: '/v1/requests', headers: { ...f.headers, 'idempotency-key': 'decision-001' }, payload: { kind: 'refund', orderId: 'oa' } });
    assert.equal(conflict.json().error, 'IDEMPOTENCY_CONFLICT');
  } finally { await f.close(); }
});
test('refund works without image/provider and unsupported visual reasons offer standard return', async () => {
  const f = fixture();
  try {
    const c = await f.app.inject({ url: '/v1/orders/oa/candidates?reason=damaged', headers: f.headers });
    assert.equal(c.json().fallback, 'STANDARD_RETURN');
    const r = await f.app.inject({ method: 'POST', url: '/v1/requests', headers: { ...f.headers, 'idempotency-key': 'refund-001' }, payload: { kind: 'refund', orderId: 'oa' } });
    assert.equal(r.statusCode, 201); assert.equal(r.json().data.difference, -5000);
  } finally { await f.close(); }
});
test('return window and quote expiry boundary', async () => {
  const f = fixture();
  try {
    const q = await f.quote(); f.advance(600000);
    const r = await f.app.inject({ method: 'POST', url: '/v1/requests', headers: { ...f.headers, 'idempotency-key': 'decision-001' }, payload: { kind: 'exchange', orderId: 'oa', quoteId: q.id } });
    assert.equal(r.json().error, 'QUOTE_EXPIRED');
    f.db.prepare('UPDATE orders SET delivered_at=delivered_at-?').run(29 * 86400000);
    assert.equal((await f.app.inject({ url: '/v1/orders/oa', headers: f.headers })).json().error, 'RETURN_WINDOW_CLOSED');
  } finally { await f.close(); }
});
test('image upload requires consent, rejects malformed bytes, strips metadata and enforces ownership', async () => {
  const f = fixture();
  try {
    const bytes = await sharp({ create: { width: 512, height: 512, channels: 3, background: 'red' } }).jpeg().withMetadata().toBuffer();
    const send = (payload: Buffer, consent?: string) => f.app.inject({ method: 'POST', url: '/v1/images', headers: { ...f.headers, 'content-type': 'image/jpeg', ...(consent ? { 'x-image-consent': consent } : {}) }, payload });
    assert.equal((await send(bytes)).statusCode, 400);
    assert.equal((await send(Buffer.from('not-an-image'), 'true')).statusCode, 422);
    const r = await send(bytes, 'true'); assert.equal(r.statusCode, 201);
    const stored = f.db.prepare('SELECT bytes FROM assets WHERE id=?').get(r.json().id)!;
    assert.equal((await sharp(Buffer.from(stored.bytes as Uint8Array)).metadata()).exif, undefined);
    assert.equal((await f.app.inject({ method: 'DELETE', url: `/v1/images/${r.json().id}`, headers: { authorization: `Bearer ${f.other}` } })).statusCode, 404);
    assert.equal((await f.app.inject({ method: 'DELETE', url: `/v1/images/${r.json().id}`, headers: f.headers })).statusCode, 204);
    assert.equal(f.db.prepare('SELECT bytes FROM assets WHERE id=?').get(r.json().id)!.bytes, null);
  } finally { await f.close(); }
});
test('merchant garment image is accessible only to an authorized shopper with an active order', async () => {
  const f = fixture();
  try {
    const jpg = await sharp({ create: { width: 512, height: 512, channels: 3, background: 'blue' } }).jpeg().toBuffer();
    f.db.prepare('INSERT INTO assets VALUES(?,?,?,?,0)').run('merchant-reference', 'merchant', jpg, 1800000000000 + 3600000);
    f.db.prepare("UPDATE products SET image_id='merchant-reference' WHERE id='new'").run();
    const url = '/v1/products/new/image';
    assert.equal((await f.app.inject(url)).statusCode, 401);
    const outsider = session(f.db, 'eve', 1800000000000);
    assert.equal((await f.app.inject({ url, headers: { authorization: `Bearer ${outsider}` } })).statusCode, 404);
    const ok = await f.app.inject({ url, headers: f.headers });
    assert.equal(ok.statusCode, 200);
    assert.match(String(ok.headers['content-type']), /^image\/jpeg/);
    assert.equal(ok.headers['cache-control'], 'no-store');
    assert.deepEqual(ok.rawPayload, jpg);
    f.db.prepare("UPDATE products SET stock=0 WHERE id='new'").run();
    assert.equal((await f.app.inject({ url, headers: f.headers })).statusCode, 404);
  } finally { await f.close(); }
});

test('public demo page serves synthetic media while shopper APIs remain protected', async () => {
  const f = fixture();
  try {
    const page = await f.app.inject({ url: '/' });
    assert.equal(page.statusCode, 200);
    assert.match(String(page.headers['content-type']), /text\/html/);
    assert.match(page.body, /RECORDED • SYNTHETIC/);
    assert.match(String(page.headers['content-security-policy']), /script-src 'self'/);
    assert.equal((await f.app.inject({ url: '/demo/app.js' })).statusCode, 200);
    assert.equal((await f.app.inject({ url: '/demo/styles.css' })).statusCode, 200);
    assert.equal((await f.app.inject({ url: '/demo/recorded-result.jpg' })).statusCode, 200);
    assert.equal((await f.app.inject({ url: '/v1/orders' })).statusCode, 401);
  } finally { await f.close(); }
});
test('provider disabled is explicit, never substituted with mock success', async () => {
  const f = fixture();
  try { assert.equal((await f.preview('missing')).json().error, 'YOUCAM_NOT_CONFIGURED'); }
  finally { await f.close(); }
});
test('mocked provider lifecycle persists task, result, and enforces preview ownership', async () => {
  const f = fixture(true);
  try {
    f.assets(); const q = await f.quote(); const r = await f.preview(q.id); assert.equal(r.statusCode, 202);
    const replay = await f.preview(q.id); assert.equal(replay.json().id, r.json().id);
    await f.worker.tick(); f.advance(10000); await f.worker.tick();
    const out = await f.app.inject({ url: `/v1/previews/${r.json().id}`, headers: f.headers });
    assert.equal(out.json().data.state, 'SUCCEEDED');
    assert.equal((await f.app.inject({ url: `/v1/previews/${r.json().id}`, headers: { authorization: `Bearer ${f.other}` } })).statusCode, 404);
  } finally { await f.close(); }
});
test('deletion during in-flight provider call prevents late result resurrection', async () => {
  const f = fixture(true);
  try {
    f.assets(); const q = await f.quote(); const r = await f.preview(q.id); await f.worker.tick(); f.advance(10000);
    let resolve!: (value: { state: 'success'; url: string }) => void;
    f.provider.poll = () => new Promise(r => { resolve = r; });
    const pending = f.worker.tick();
    await f.app.inject({ method: 'DELETE', url: '/v1/images/self', headers: f.headers });
    resolve({ state: 'success', url: 'https://yce-us.s3-accelerate.amazonaws.com/late.jpg' }); await pending;
    const out = (await f.app.inject({ url: `/v1/previews/${r.json().id}`, headers: f.headers })).json().data;
    assert.equal(out.state, 'DELETED'); assert.equal(out.result_url, null);
  } finally { await f.close(); }
});
test('durable render quota counts failures/deletions and blocks repeated paid attempts', async () => {
  const f = fixture(true);
  try {
    f.assets(); const q = await f.quote();
    assert.equal((await f.preview(q.id, 'preview-001')).statusCode, 202);
    assert.equal((await f.preview(q.id, 'preview-002')).statusCode, 202);
    assert.equal((await f.preview(q.id, 'preview-003')).json().error, 'RENDER_BUDGET_EXHAUSTED');
  } finally { await f.close(); }
});
test('ambiguous submission crash is failed without resubmitting; polling is bounded', async () => {
  const f = fixture(true);
  try {
    f.assets(); const q = await f.quote(); const r = await f.preview(q.id);
    f.db.prepare("UPDATE jobs SET state='SUBMITTING' WHERE id=?").run(r.json().id);
    f.worker.recover(); assert.equal(f.db.prepare('SELECT error FROM jobs').get()!.error, 'SUBMISSION_INTERRUPTED');
    f.db.prepare("UPDATE jobs SET state='POLLING',task_id='x',polls=30").run();
    await f.worker.tick(); assert.equal(f.db.prepare('SELECT error FROM jobs').get()!.error, 'RENDER_TIMEOUT');
  } finally { await f.close(); }
});
