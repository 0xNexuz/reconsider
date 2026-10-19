import { z } from 'zod';
import { database } from './db.js';
import { productFor } from './domain.js';

const [id, rawStock] = process.argv.slice(2);
if (!id || rawStock === undefined) throw new Error('Usage: npm run catalog:stock -- <product-id> <nonnegative-stock>');
const stock = z.coerce.number().int().min(0).max(1000000).parse(rawStock);
const db = database(process.env.DATABASE_PATH ?? './data/reconsider.sqlite');
productFor(db, id);
db.prepare('UPDATE products SET stock=?,version=version+1 WHERE id=?').run(stock, id);
db.close();
console.log('Updated demonstration inventory; existing quotes for this item now require refresh.');
