import { writeFileSync } from 'node:fs';
import { database, session, transaction } from './db.js';

const db = database(process.env.DATABASE_PATH ?? './data/reconsider.sqlite');
const now = Date.now();
transaction(db, () => {
  const add = db.prepare('INSERT OR IGNORE INTO products(id,name,size,neckline,price,currency,stock) VALUES(?,?,?,?,?,?,?)');
  add.run('original', 'Demo high-neck blouse', 'M', 'high', 5000, 'USD', 5);
  add.run('v-neck', 'Demo V-neck blouse', 'M', 'v', 5500, 'USD', 3);
  add.run('round-neck', 'Demo round-neck blouse', 'M', 'round', 4500, 'USD', 2);
  add.run('sold-out', 'Demo unavailable blouse', 'M', 'v', 4000, 'USD', 0);
  const addOrder = db.prepare('INSERT OR IGNORE INTO orders VALUES(?,?,?,?,?,?)');
  addOrder.run('order-alice', 'alice', 'original', 5000, 'USD', now - 86400000);
  addOrder.run('order-bob', 'bob', 'original', 5000, 'USD', now - 86400000);
  db.prepare("DELETE FROM sessions WHERE user_id IN ('alice','bob')").run();
});
const access = { expiresAt: new Date(now + 86400000).toISOString(), alice: session(db, 'alice', now), bob: session(db, 'bob', now) };
writeFileSync('demo-access.json', JSON.stringify(access, null, 2), { mode: 0o600 });
db.close();
console.log('Seeded demonstration catalog/orders. Local 24-hour bearer tokens written to ignored demo-access.json. Re-seeding rotates tokens but preserves orders and requests.');
