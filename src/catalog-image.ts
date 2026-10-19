import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { database, transaction } from './db.js';
import { normalizeImage } from './images.js';
import { productFor } from './domain.js';

const [productId, file] = process.argv.slice(2);
if (!productId || !file) throw new Error('Usage: npm run catalog:image -- <product-id> <licensed-image-path>');
const db = database(process.env.DATABASE_PATH ?? './data/reconsider.sqlite');
productFor(db, productId);
const bytes = await normalizeImage(readFileSync(file));
const id = randomUUID();
transaction(db, () => {
  db.prepare('INSERT INTO assets VALUES(?,?,?,?,0)').run(id, 'merchant', bytes, Date.now() + 30 * 86400000);
  db.prepare('UPDATE products SET image_id=?,version=version+1 WHERE id=?').run(id, productId);
});
db.close();
console.log('Stored normalized merchant reference image locally. No provider call made.');
