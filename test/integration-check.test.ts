import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';

test('offline preflight checks images without exposing a configured key', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'reconsider-check-'));
  const garment = join(directory, 'garment.jpg');
  const shopper = join(directory, 'shopper.jpg');
  try {
    await sharp({ create: { width: 768, height: 1024, channels: 3, background: 'white' } }).jpeg().toFile(garment);
    await sharp({ create: { width: 768, height: 1024, channels: 3, background: 'blue' } }).jpeg().toFile(shopper);
    const run = (other: string) => spawnSync(process.execPath,
      ['--import', 'tsx', 'src/integration-check.ts', garment, other],
      { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, YOUCAM_API_KEY: 'test-sentinel-secret', YOUCAM_ENABLED: 'false' } });
    const ok = run(shopper);
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /Garment: local image accepted/);
    assert.match(ok.stdout, /Shopper: local image accepted/);
    assert.match(ok.stdout, /YouCam key: present/);
    assert.doesNotMatch(ok.stdout + ok.stderr, /test-sentinel-secret/);
    const missing = run(join(directory, 'missing.jpg'));
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /Shopper: missing, unreadable, or unsupported image/);
  } finally {
    if (existsSync(garment)) unlinkSync(garment);
    if (existsSync(shopper)) unlinkSync(shopper);
    rmdirSync(directory);
  }
});

test('live runner refuses to start without explicit one-render approval', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/live-one.ts', 'missing-garment.jpg', 'missing-shopper.jpg'],
    { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, YOUCAM_API_KEY: 'test-sentinel-secret', LIVE_RENDER_APPROVED: '', NODE_TLS_REJECT_UNAUTHORIZED: '0' } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /LIVE_RENDER_APPROVED=one/);
  assert.doesNotMatch(result.stdout + result.stderr, /test-sentinel-secret/);
});
