import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
import { database, session } from '../dist/db.js';

const directory = mkdtempSync(join(tmpdir(), 'reconsider-smoke-'));
const path = join(directory, 'test.sqlite');
const db = database(path);
const token = session(db, 'smoke');
db.close();
const portProbe = createServer(); portProbe.listen(0, '127.0.0.1'); await once(portProbe, 'listening');
const port = portProbe.address().port; await new Promise(r => portProbe.close(r));
const child = spawn(process.execPath, ['dist/server.js'], { env: { ...process.env, DATABASE_PATH: path, PORT: String(port), HOST: '127.0.0.1', YOUCAM_ENABLED: 'false', YOUCAM_API_KEY: '', NODE_TLS_REJECT_UNAUTHORIZED: '1' }, stdio: 'ignore' });
const exited = once(child, 'exit');
try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try { const response = await fetch(`http://127.0.0.1:${port}/health`); if (response.ok) { assert.equal((await response.json()).youcam, 'DISABLED'); ready = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  assert.ok(ready, 'compiled server starts');
  assert.equal((await fetch(`http://127.0.0.1:${port}/v1/orders`)).status, 401);
  const response = await fetch(`http://127.0.0.1:${port}/v1/orders`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.status, 200); assert.deepEqual((await response.json()).data, []);
  console.log('PASS: compiled server, real HTTP, persisted session, protected route, provider disabled.');
} finally {
  child.kill(); await exited;
  rmSync(directory, { recursive: true, force: true });
}
