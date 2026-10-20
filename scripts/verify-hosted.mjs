import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = process.argv[2];
if (!base || !/^https:\/\//.test(base)) throw new Error('Usage: node scripts/verify-hosted.mjs https://deployed-host');
const url = path => new URL(path, base);
async function json(path, init = {}) {
  const response = await fetch(url(path), { ...init, redirect: 'error' });
  const body = await response.json();
  return { response, body };
}
const page = await fetch(url('/'));
assert.equal(page.status, 200);
assert.match(await page.text(), /The right piece/);
const health = await json('/health');
assert.equal(health.response.status, 200);
assert.equal(health.body.persistence, 'BROWSER_SESSION');
assert.equal(health.body.youcam, 'RECORDED_ONLY');
for (const id of ['v-neck', 'round-neck', 'collared']) {
  const image = await fetch(url(`/demo/results/${id}.jpg`));
  assert.equal(image.status, 200);
  assert.match(image.headers.get('content-type') ?? '', /image\/jpeg/);
  assert.ok((await image.arrayBuffer()).byteLength > 10000);
}
const opened = await json('/demo/session', { method: 'POST' });
assert.equal(opened.response.status, 201);
assert.equal(opened.body.providerCalls, false);
const authorization = `Bearer ${opened.body.token}`;
const orders = await json('/v1/orders', { headers: { authorization } });
assert.equal(orders.body.data[0].id, opened.body.orderId);
const candidates = await json(`/v1/orders/${opened.body.orderId}/candidates?reason=style`, { headers: { authorization } });
assert.deepEqual(candidates.body.data.map(item => item.id), ['round-neck', 'collared', 'v-neck']);
const reference = await fetch(url('/v1/products/round-neck/image'), { headers: { authorization } });
assert.equal(reference.status, 200);
assert.match(reference.headers.get('content-type') ?? '', /image\/png/);
const quote = await json('/v1/quotes', { method: 'POST', headers: { authorization, 'content-type': 'application/json' }, body: JSON.stringify({ orderId: opened.body.orderId, productId: 'round-neck', reason: 'style' }) });
assert.equal(quote.response.status, 201);
assert.equal(quote.body.data.difference, -500);
const receipt = await json('/v1/requests', { method: 'POST', headers: { authorization, 'content-type': 'application/json', 'idempotency-key': `verify-${randomUUID()}` }, body: JSON.stringify({ kind: 'exchange', orderId: opened.body.orderId, quoteId: quote.body.data.id }) });
assert.equal(receipt.response.status, 201);
assert.equal(receipt.body.status, 'REQUESTED');
assert.equal(receipt.body.paymentExecuted, false);
const denied = await json('/v1/previews', { method: 'POST', headers: { authorization } });
assert.equal(denied.response.status, 403);
console.log('PASS: public page, three real recorded assets, serverless demo session, three choices, image, quote, exchange receipt, and provider denial. No YouCam units used.');
