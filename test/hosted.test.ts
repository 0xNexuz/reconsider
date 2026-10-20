import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DEMO_SECRET = 'hosted-test-secret-with-at-least-32-bytes';
const { default: app } = await import('../api/handler.js');
const call = (path: string, init: RequestInit = {}) => app.fetch(new Request(`https://demo.example${path}`, init));

test('hosted demo serves three recorded looks with server-calculated choices', async () => {
  const health = await call('/health');
  assert.equal((await health.json()).persistence, 'BROWSER_SESSION');
  const opened = await call('/demo/session', { method: 'POST' });
  assert.equal(opened.status, 201);
  const { token, orderId } = await opened.json();
  const headers = { authorization: `Bearer ${token}` };
  const orders = await call('/v1/orders', { headers });
  assert.equal((await orders.json()).data[0].id, orderId);
  const candidates = await call(`/v1/orders/${orderId}/candidates?reason=style`, { headers });
  assert.deepEqual((await candidates.json()).data.map((item: { id: string }) => item.id), ['round-neck', 'collared', 'v-neck']);
  assert.equal((await call('/v1/products/round-neck/image', { headers })).status, 302);
  const quote = await call('/v1/quotes', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ orderId, productId: 'round-neck', reason: 'style' }) });
  assert.equal(quote.status, 201);
  const priced = (await quote.json()).data;
  assert.equal(priced.difference, -500);
  const receipt = await call('/v1/requests', { method: 'POST', headers: { ...headers, 'content-type': 'application/json', 'idempotency-key': 'hosted-test-request' }, body: JSON.stringify({ kind: 'exchange', orderId, quoteId: priced.id }) });
  assert.equal(receipt.status, 201);
  assert.equal((await receipt.json()).persistence, 'BROWSER_SESSION');
  assert.equal((await call('/v1/previews', { method: 'POST', headers })).status, 403);
});

test('hosted demo rejects forged sessions, altered quotes, and cross-order decisions', async () => {
  assert.equal((await call('/v1/orders')).status, 401);
  const first = await (await call('/demo/session', { method: 'POST' })).json();
  const second = await (await call('/demo/session', { method: 'POST' })).json();
  const headers = { authorization: `Bearer ${first.token}`, 'content-type': 'application/json' };
  assert.equal((await call('/v1/orders', { headers: { authorization: `Bearer ${first.token}x` } })).status, 401);
  const quote = (await (await call('/v1/quotes', { method: 'POST', headers, body: JSON.stringify({ orderId: first.orderId, productId: 'collared', reason: 'style' }) })).json()).data;
  const bad = await call('/v1/requests', { method: 'POST', headers: { ...headers, 'idempotency-key': 'hosted-test-forgery' }, body: JSON.stringify({ kind: 'exchange', orderId: first.orderId, quoteId: quote.id.slice(0, -1) + 'x' }) });
  assert.equal(bad.status, 409);
  assert.equal((await call('/v1/requests', { method: 'POST', headers: { ...headers, 'idempotency-key': 'hosted-other-order' }, body: JSON.stringify({ kind: 'exchange', orderId: second.orderId, quoteId: quote.id }) })).status, 400);
});
