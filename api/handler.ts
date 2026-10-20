import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

// Judge-facing, recorded-only demo. The full SQLite/YouCam integration remains
// the locally installable application in src/. This function cannot spend units.
const catalog = [
  { id: 'round-neck', name: 'Demo round-neck blouse', size: 'M', neckline: 'round', price: 4500, currency: 'USD', stock: 2, version: 1, preview_available: true },
  { id: 'collared', name: 'Demo collared blouse', size: 'M', neckline: 'collared', price: 5200, currency: 'USD', stock: 4, version: 1, preview_available: true },
  { id: 'v-neck', name: 'Demo V-neck blouse', size: 'M', neckline: 'v', price: 5500, currency: 'USD', stock: 3, version: 1, preview_available: true }
] as const;
type Session = { kind: 'session'; user: string; orderId: string; exp: number };
type Quote = { kind: 'quote'; user: string; orderId: string; productId: string; difference: number; exp: number };
type Claim = Session | Quote;
const secret = process.env.DEMO_SECRET;
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
function response(body: object, status = 200) { return Response.json(body, { status, headers }); }
function failure(code: string, status: number) { return response({ error: code }, status); }
function sign(claim: Claim) {
  const value = Buffer.from(JSON.stringify(claim)).toString('base64url');
  const mac = createHmac('sha256', secret!).update(value).digest('base64url');
  return `${value}.${mac}`;
}
function verify(value: string): Claim | null {
  const parts = value.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const expected = createHmac('sha256', secret!).update(parts[0]).digest();
  let received: Buffer;
  try { received = Buffer.from(parts[1], 'base64url'); } catch { return null; }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  try {
    const claim = JSON.parse(Buffer.from(parts[0], 'base64url').toString()) as Claim;
    return claim && typeof claim.exp === 'number' && claim.exp > Date.now() ? claim : null;
  } catch { return null; }
}
async function bodyOf(request: Request): Promise<Record<string, unknown> | null> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) return null;
  try {
    const body: unknown = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch { return null; }
}
function sessionOf(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  const claim = token ? verify(token) : null;
  return claim?.kind === 'session' && typeof claim.user === 'string' && typeof claim.orderId === 'string' ? claim : null;
}

export default {
  async fetch(request: Request) {
    if (!secret || secret.length < 32) return failure('DEMO_NOT_CONFIGURED', 503);
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    if (path === '/health' && method === 'GET') return response({ status: 'ok', commerce: 'SIMULATED', youcam: 'RECORDED_ONLY', guestDemo: true, persistence: 'BROWSER_SESSION' });
    if (path === '/demo/session' && method === 'POST') {
      const claim: Session = { kind: 'session', user: randomUUID(), orderId: randomUUID(), exp: Date.now() + 86400000 };
      return response({ token: sign(claim), orderId: claim.orderId, expiresAt: claim.exp, commerce: 'SIMULATED', providerCalls: false }, 201);
    }
    const session = sessionOf(request);
    if (!session) return failure('UNAUTHORIZED', 401);
    const order = { id: session.orderId, user_id: session.user, product_id: 'original', paid: 5000, currency: 'USD', delivered_at: Date.now() - 86400000 };
    if (path === '/v1/orders' && method === 'GET') return response({ data: [order], commerce: 'SIMULATED' });
    if (path === `/v1/orders/${session.orderId}/candidates` && method === 'GET') {
      const reason = url.searchParams.get('reason');
      if (!['style', 'size', 'damaged', 'other'].includes(reason ?? '')) return failure('INVALID_INPUT', 400);
      return response({ data: reason === 'style' ? catalog : [], commerce: 'SIMULATED', ...(reason !== 'style' ? { fallback: 'STANDARD_RETURN' } : {}) });
    }
    const productImage = path.match(/^\/v1\/products\/(v-neck|round-neck|collared)\/image$/);
    if (productImage && method === 'GET') return Response.redirect(new URL(`/demo/garments/${productImage[1]}.png`, request.url));
    if (path === '/v1/quotes' && method === 'POST') {
      const input = await bodyOf(request);
      const product = catalog.find(item => item.id === input?.productId);
      if (!input || input.orderId !== session.orderId || input.reason !== 'style' || !product) return failure('INVALID_INPUT', 400);
      const claim: Quote = { kind: 'quote', user: session.user, orderId: session.orderId, productId: product.id, difference: product.price - order.paid, exp: Date.now() + 600000 };
      return response({ data: { id: sign(claim), order_id: claim.orderId, product_id: product.id, difference: claim.difference, expires_at: claim.exp }, commerce: 'SIMULATED', reservation: false }, 201);
    }
    if (path === '/v1/requests' && method === 'POST') {
      const input = await bodyOf(request);
      if (!input || input.orderId !== session.orderId || !['refund', 'exchange'].includes(String(input.kind))) return failure('INVALID_INPUT', 400);
      let productId: string | null = null;
      let difference = -order.paid;
      if (input.kind === 'exchange') {
        const claim = typeof input.quoteId === 'string' ? verify(input.quoteId) : null;
        if (!claim || claim.kind !== 'quote' || claim.user !== session.user || claim.orderId !== session.orderId) return failure('QUOTE_EXPIRED', 409);
        const product = catalog.find(item => item.id === claim.productId);
        if (!product || product.stock <= 0 || product.price - order.paid !== claim.difference) return failure('QUOTE_STALE', 409);
        productId = product.id; difference = claim.difference;
      }
      const key = request.headers.get('idempotency-key');
      if (!key || !/^[a-zA-Z0-9_-]{8,100}$/.test(key)) return failure('INVALID_INPUT', 400);
      const id = createHmac('sha256', secret).update(`${session.user}:${key}`).digest('hex').slice(0, 32);
      return response({ data: { id, kind: input.kind, order_id: session.orderId, product_id: productId, difference, currency: 'USD', created_at: Date.now() }, status: 'REQUESTED', commerce: 'SIMULATED', paymentExecuted: false, inventoryReserved: false, persistence: 'BROWSER_SESSION' }, 201);
    }
    if (path === '/v1/requests' && method === 'GET') return response({ data: [], commerce: 'SIMULATED', persistence: 'BROWSER_SESSION' });
    if (path === '/v1/images' || path.startsWith('/v1/previews')) return failure('GUEST_PREVIEW_DISABLED', 403);
    return failure('NOT_FOUND', 404);
  }
};
