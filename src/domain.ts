import { randomUUID } from 'node:crypto';
import type { DB } from './db.js';
import { transaction } from './db.js';

export class Fault extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
export type Product = { id: string; name: string; size: string; neckline: string; price: number; currency: string; stock: number; version: number; image_id: string | null };
export type Order = { id: string; user_id: string; product_id: string; paid: number; currency: string; delivered_at: number };
export type Quote = { id: string; user_id: string; order_id: string; product_id: string; product_version: number; difference: number; reason: string; expires_at: number };
export function orderFor(db: DB, user: string, id: string, now: number): Order {
  const order = db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(id, user) as Order | undefined;
  if (!order) throw new Fault(404, 'ORDER_NOT_FOUND');
  if (now < order.delivered_at || now >= order.delivered_at + 30 * 86400000) throw new Fault(409, 'RETURN_WINDOW_CLOSED');
  return order;
}
export function availableOrder(db: DB, user: string, id: string, now: number) {
  const order = orderFor(db, user, id, now);
  if (db.prepare('SELECT id FROM requests WHERE order_id=?').get(id)) throw new Fault(409, 'REQUEST_ALREADY_EXISTS');
  return order;
}
export function productFor(db: DB, id: string): Product {
  const p = db.prepare('SELECT * FROM products WHERE id=?').get(id) as Product | undefined;
  if (!p) throw new Fault(404, 'PRODUCT_NOT_FOUND');
  return p;
}
export function quoteFor(db: DB, user: string, id: string, now: number): Quote {
  const q = db.prepare('SELECT * FROM quotes WHERE id=? AND user_id=?').get(id, user) as Quote | undefined;
  if (!q) throw new Fault(404, 'QUOTE_NOT_FOUND');
  if (now >= q.expires_at) throw new Fault(409, 'QUOTE_EXPIRED');
  const order = availableOrder(db, user, q.order_id, now);
  const p = productFor(db, q.product_id);
  if (p.stock < 1 || p.version !== q.product_version || p.currency !== order.currency || p.price - order.paid !== q.difference) {
    throw new Fault(409, 'QUOTE_STALE');
  }
  return q;
}
export function createQuote(db: DB, user: string, input: { orderId: string; productId: string; reason: string }, now: number) {
  const order = availableOrder(db, user, input.orderId, now);
  const p = productFor(db, input.productId);
  if (input.reason !== 'style') throw new Fault(422, 'VISUAL_EXCHANGE_NOT_APPLICABLE');
  if (p.stock < 1 || p.currency !== order.currency || p.id === order.product_id) throw new Fault(409, 'PRODUCT_INELIGIBLE');
  const id = randomUUID();
  db.prepare('INSERT INTO quotes VALUES(?,?,?,?,?,?,?,?)').run(id, user, order.id, p.id, p.version, p.price - order.paid, input.reason, now + 600000);
  return quoteFor(db, user, id, now);
}
export function decide(db: DB, user: string, input: { kind: 'refund' | 'exchange'; orderId: string; quoteId?: string }, idem: string, now: number) {
  const fingerprint = JSON.stringify(input);
  return transaction(db, () => {
    const previous = db.prepare('SELECT * FROM requests WHERE user_id=? AND idem=?').get(user, idem);
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new Fault(409, 'IDEMPOTENCY_CONFLICT');
      return previous;
    }
    const order = availableOrder(db, user, input.orderId, now);
    let q: Quote | undefined;
    if (input.kind === 'exchange') {
      if (!input.quoteId) throw new Fault(400, 'QUOTE_REQUIRED');
      q = quoteFor(db, user, input.quoteId, now);
      if (q.order_id !== order.id) throw new Fault(409, 'QUOTE_ORDER_MISMATCH');
    }
    const id = randomUUID();
    db.prepare('INSERT INTO requests VALUES(?,?,?,?,?,?,?,?,?,?)').run(id, user, order.id, input.kind, q?.product_id ?? null, q?.difference ?? -order.paid, order.currency, idem, fingerprint, now);
    return db.prepare('SELECT * FROM requests WHERE id=?').get(id)!;
  });
}
