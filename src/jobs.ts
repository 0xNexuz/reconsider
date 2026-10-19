import { randomUUID } from 'node:crypto';
import type { DB } from './db.js';
import { transaction } from './db.js';
import { Fault, productFor, quoteFor } from './domain.js';
import type { Provider } from './youcam.js';

export type Job = { id: string; user_id: string; quote_id: string; asset_id: string; ref_asset_id: string; state: string; task_id: string | null; result_url: string | null; error: string | null; created_at: number; next_poll: number; expires_at: number; polls: number; fingerprint: string };
export function assetBytes(db: DB, id: string, user: string, now: number) {
  const asset = db.prepare('SELECT bytes FROM assets WHERE id=? AND user_id=? AND deleted=0 AND expires_at>?').get(id, user, now);
  if (!asset?.bytes) throw new Fault(404, 'IMAGE_NOT_FOUND');
  return Buffer.from(asset.bytes as Uint8Array);
}
export function queue(db: DB, provider: Provider, user: string, input: { quoteId: string; assetId: string; consent: true }, idem: string, now: number, limits: { global: number; user: number }) {
  if (!provider.enabled) throw new Fault(503, 'YOUCAM_NOT_CONFIGURED');
  return transaction(db, () => {
    const fingerprint = JSON.stringify(input);
    const old = db.prepare('SELECT * FROM jobs WHERE user_id=? AND idem=?').get(user, idem) as Job | undefined;
    if (old) {
      if (old.fingerprint !== fingerprint) throw new Fault(409, 'IDEMPOTENCY_CONFLICT');
      return old;
    }
    const q = quoteFor(db, user, input.quoteId, now);
    const p = productFor(db, q.product_id);
    if (!p.image_id) throw new Fault(409, 'CATALOG_IMAGE_REQUIRED');
    assetBytes(db, input.assetId, user, now);
    assetBytes(db, p.image_id, 'merchant', now);
    const since = now - 86400000;
    const total = db.prepare('SELECT COUNT(*) AS n FROM jobs WHERE created_at>?').get(since)!.n as number;
    const mine = db.prepare('SELECT COUNT(*) AS n FROM jobs WHERE created_at>? AND user_id=?').get(since, user)!.n as number;
    if (total >= limits.global || mine >= limits.user) throw new Fault(429, 'RENDER_BUDGET_EXHAUSTED');
    const id = randomUUID();
    db.prepare(`INSERT INTO jobs(id,user_id,quote_id,asset_id,ref_asset_id,idem,fingerprint,state,created_at,next_poll,expires_at)
      VALUES(?,?,?,?,?,?,?,'QUEUED',?,?,?)`).run(id, user, q.id, input.assetId, p.image_id, idem, fingerprint, now, now, now + 3600000);
    return db.prepare('SELECT * FROM jobs WHERE id=?').get(id) as Job;
  });
}
export function erase(db: DB, user: string, id: string) {
  return transaction(db, () => {
    const row = db.prepare('SELECT id FROM assets WHERE id=? AND user_id=?').get(id, user);
    if (!row) throw new Fault(404, 'IMAGE_NOT_FOUND');
    db.prepare('UPDATE assets SET bytes=NULL,deleted=1 WHERE id=?').run(id);
    db.prepare("UPDATE jobs SET state='DELETED',result_url=NULL,task_id=NULL,error=NULL WHERE asset_id=? AND user_id=?").run(id, user);
  });
}
export function cleanup(db: DB, now: number) {
  db.prepare('UPDATE assets SET bytes=NULL,deleted=1 WHERE expires_at<=?').run(now);
  db.prepare(`UPDATE jobs SET state='EXPIRED',result_url=NULL,task_id=NULL WHERE state!='DELETED'
    AND (expires_at<=? OR asset_id IN (SELECT id FROM assets WHERE deleted=1))`).run(now);
  db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now);
}
export class Worker {
  private busy = false;
  constructor(private db: DB, private provider: Provider, private now = Date.now) {}
  recover() {
    // A crash during task submission is ambiguous: never blindly repeat a billable POST.
    this.db.prepare("UPDATE jobs SET state='FAILED',error='SUBMISSION_INTERRUPTED' WHERE state='SUBMITTING'").run();
  }
  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      cleanup(this.db, this.now());
      if (!this.provider.enabled) return;
      const j = this.db.prepare("SELECT * FROM jobs WHERE state IN ('QUEUED','POLLING') AND next_poll<=? ORDER BY created_at LIMIT 1").get(this.now()) as Job | undefined;
      if (!j) return;
      if (j.state === 'QUEUED') {
        const claimed = this.db.prepare("UPDATE jobs SET state='SUBMITTING' WHERE id=? AND state='QUEUED'").run(j.id);
        if (!claimed.changes) return;
        try {
          quoteFor(this.db, j.user_id, j.quote_id, this.now());
          const source = await this.provider.upload(assetBytes(this.db, j.asset_id, j.user_id, this.now()));
          if (!this.active(j.id)) return;
          const reference = await this.provider.upload(assetBytes(this.db, j.ref_asset_id, 'merchant', this.now()));
          if (!this.active(j.id)) return;
          const task = await this.provider.create(source, reference);
          this.db.prepare("UPDATE jobs SET state='POLLING',task_id=?,next_poll=? WHERE id=? AND state='SUBMITTING'").run(task, this.now() + 10000, j.id);
        } catch (e) {
          this.db.prepare("UPDATE jobs SET state='FAILED',error=? WHERE id=? AND state='SUBMITTING'").run(e instanceof Fault ? e.code : 'SUBMISSION_FAILED', j.id);
        }
      } else {
        if (j.polls >= 30 || !j.task_id) {
          this.db.prepare("UPDATE jobs SET state='FAILED',error='RENDER_TIMEOUT' WHERE id=? AND state='POLLING'").run(j.id); return;
        }
        this.db.prepare('UPDATE jobs SET polls=polls+1,next_poll=? WHERE id=?').run(this.now() + 10000, j.id);
        try {
          const result = await this.provider.poll(j.task_id);
          if (result.state === 'success' && result.url) this.db.prepare("UPDATE jobs SET state='SUCCEEDED',result_url=? WHERE id=? AND state='POLLING'").run(result.url, j.id);
          else if (result.state === 'error') this.db.prepare("UPDATE jobs SET state='FAILED',error='RENDER_FAILED' WHERE id=? AND state='POLLING'").run(j.id);
        } catch { /* Bounded status GET retries; never resubmit the task. */ }
      }
    } finally { this.busy = false; }
  }
  private active(id: string) {
    cleanup(this.db, this.now());
    return this.db.prepare("SELECT id FROM jobs WHERE id=? AND state='SUBMITTING'").get(id);
  }
}
