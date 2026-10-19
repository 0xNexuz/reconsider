import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';

export function database(path = ':memory:') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS products(
      id TEXT PRIMARY KEY, name TEXT NOT NULL, size TEXT NOT NULL, neckline TEXT NOT NULL,
      price INTEGER NOT NULL CHECK(price>=0), currency TEXT NOT NULL, stock INTEGER NOT NULL CHECK(stock>=0),
      version INTEGER NOT NULL DEFAULT 1, image_id TEXT);
    CREATE TABLE IF NOT EXISTS orders(
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, product_id TEXT NOT NULL REFERENCES products(id),
      paid INTEGER NOT NULL CHECK(paid>=0), currency TEXT NOT NULL, delivered_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS quotes(
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, order_id TEXT NOT NULL REFERENCES orders(id),
      product_id TEXT NOT NULL REFERENCES products(id), product_version INTEGER NOT NULL,
      difference INTEGER NOT NULL, reason TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS requests(
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
      kind TEXT NOT NULL, product_id TEXT, difference INTEGER NOT NULL, currency TEXT NOT NULL,
      idem TEXT NOT NULL, fingerprint TEXT NOT NULL, created_at INTEGER NOT NULL,
      UNIQUE(user_id,idem));
    CREATE TABLE IF NOT EXISTS assets(
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, bytes BLOB, expires_at INTEGER NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS jobs(
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, quote_id TEXT NOT NULL REFERENCES quotes(id),
      asset_id TEXT NOT NULL REFERENCES assets(id), ref_asset_id TEXT NOT NULL REFERENCES assets(id),
      idem TEXT NOT NULL, fingerprint TEXT NOT NULL, state TEXT NOT NULL, task_id TEXT,
      result_url TEXT, error TEXT, polls INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL, next_poll INTEGER NOT NULL, expires_at INTEGER NOT NULL,
      UNIQUE(user_id,idem));
  `);
  return db;
}
export type DB = ReturnType<typeof database>;
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function session(db: DB, user: string, now = Date.now()) {
  const token = randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token), user, now + 86400000);
  return token;
}
export function transaction<T>(db: DB, action: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try { const result = action(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
