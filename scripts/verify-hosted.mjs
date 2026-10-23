import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

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
const results = {
  'v-neck': 'youcam-result-1792439336399.jpg',
  'round-neck': 'youcam-result-1792459738608.jpg',
  collared: 'youcam-result-1792459818444.jpg'
};
for (const [id, file] of Object.entries(results)) {
  const image = await fetch(url(`/demo/results/${id}.jpg`));
  assert.equal(image.status, 200);
  assert.match(image.headers.get('content-type') ?? '', /image\/jpeg/);
  const actual = createHash('sha256').update(Buffer.from(await image.arrayBuffer())).digest('hex');
  const expected = createHash('sha256').update(readFileSync(new URL(`../demo-assets/${file}`, import.meta.url))).digest('hex');
  assert.equal(actual, expected, `${id} must match its recorded provider result`);
}
const opened = await json('/demo/session', { method: 'POST' });
assert.equal(opened.response.status, 201);
assert.equal(opened.body.providerCalls, false);
const authorization = `Bearer ${opened.body.token}`;
const orders = await json('/v1/orders', { headers: { authorization } });
assert.equal(orders.body.data[0].id, opened.body.orderId);
const candidates = await json(`/v1/orders/${opened.body.orderId}/candidates?reason=style`, { headers: { authorization } });
assert.deepEqual(candidates.body.data.map(item => item.id), ['round-neck', 'collared', 'v-neck']);
for (const [id, difference] of [['round-neck', -500], ['collared', 200], ['v-neck', 500]]) {
  const reference = await fetch(url(`/v1/products/${id}/image`), { headers: { authorization } });
  assert.equal(reference.status, 200);
  assert.match(reference.headers.get('content-type') ?? '', /image\/png/);
  const priced = await json('/v1/quotes', { method: 'POST', headers: { authorization, 'content-type': 'application/json' }, body: JSON.stringify({ orderId: opened.body.orderId, productId: id, reason: 'style' }) });
  assert.equal(priced.response.status, 201);
  assert.equal(priced.body.data.difference, difference);
}
const quote = await json('/v1/quotes', { method: 'POST', headers: { authorization, 'content-type': 'application/json' }, body: JSON.stringify({ orderId: opened.body.orderId, productId: 'round-neck', reason: 'style' }) });
const receipt = await json('/v1/requests', { method: 'POST', headers: { authorization, 'content-type': 'application/json', 'idempotency-key': `verify-${randomUUID()}` }, body: JSON.stringify({ kind: 'exchange', orderId: opened.body.orderId, quoteId: quote.body.data.id }) });
assert.equal(receipt.response.status, 201);
assert.equal(receipt.body.status, 'REQUESTED');
assert.equal(receipt.body.paymentExecuted, false);
const forged = await json('/v1/requests', { method: 'POST', headers: { authorization, 'content-type': 'application/json', 'idempotency-key': `verify-${randomUUID()}` }, body: JSON.stringify({ kind: 'exchange', orderId: opened.body.orderId, quoteId: quote.body.data.id + 'x' }) });
assert.equal(forged.response.status, 409);
const other = await json('/demo/session', { method: 'POST' });
const crossed = await json('/v1/requests', { method: 'POST', headers: { authorization: `Bearer ${other.body.token}`, 'content-type': 'application/json', 'idempotency-key': `verify-${randomUUID()}` }, body: JSON.stringify({ kind: 'exchange', orderId: other.body.orderId, quoteId: quote.body.data.id }) });
assert.equal(crossed.response.status, 409);
for (const reason of ['size', 'damaged', 'other']) {
  const fallback = await json(`/v1/orders/${other.body.orderId}/candidates?reason=${reason}`, { headers: { authorization: `Bearer ${other.body.token}` } });
  assert.deepEqual(fallback.body.data, []);
  assert.equal(fallback.body.fallback, 'STANDARD_RETURN');
}
const refund = await json('/v1/requests', { method: 'POST', headers: { authorization: `Bearer ${other.body.token}`, 'content-type': 'application/json', 'idempotency-key': `verify-${randomUUID()}` }, body: JSON.stringify({ kind: 'refund', orderId: other.body.orderId }) });
assert.equal(refund.response.status, 201);
assert.equal(refund.body.data.kind, 'refund');
assert.equal(refund.body.paymentExecuted, false);
const denied = await json('/v1/previews', { method: 'POST', headers: { authorization } });
assert.equal(denied.response.status, 403);
const uploadDenied = await json('/v1/images', { method: 'POST', headers: { authorization } });
assert.equal(uploadDenied.response.status, 403);
console.log('PASS: public page; three recorded assets match local hashes; guest isolation; three garment images and quotes; exchange and refund decisions; invalid/cross-session quote denial; non-style guidance; provider denial. No YouCam units used.');
