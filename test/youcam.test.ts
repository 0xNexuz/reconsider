import test from 'node:test';
import assert from 'node:assert/strict';
import { storageURL, YouCam } from '../src/youcam.js';

test('YouCam transport contract: metadata, binary PUT, V4 task and polling (mock HTTP)', async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const replies = [
    { status: 200, data: { files: [{ file_id: 'file-1', requests: [{ method: 'PUT', url: 'https://yce-us.s3-accelerate.amazonaws.com/image?signature=test' }] }] } },
    {}, { status: 200, data: { task_id: 'task/1' } },
    { status: 200, data: { task_status: 'success', results: { url: 'https://yce-us.s3-accelerate.amazonaws.com/output' } } }
  ];
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init }); return new Response(JSON.stringify(replies.shift()), { status: 200 });
  }) as typeof fetch;
  const client = new YouCam('test-secret', true, fetcher);
  assert.equal(await client.upload(Buffer.from('test-image')), 'file-1');
  assert.equal(await client.create('file-1', 'ref-1'), 'task/1');
  assert.equal((await client.poll('task/1')).state, 'success');
  assert.equal((calls[1]!.init!.headers as Record<string, string>).Authorization, undefined);
  assert.equal(calls[1]!.init!.redirect, 'error');
  assert.deepEqual(JSON.parse(calls[2]!.init!.body as string), { src_file_id: 'file-1', ref_file_id: 'ref-1', garment_category: 'upper_body', filter_multi_person: 'strict' });
  assert.ok(calls[3]!.url.endsWith('task%2F1'));
});
test('provider upload/result URL validation rejects SSRF and deceptive hostnames', () => {
  for (const url of ['http://127.0.0.1/a', 'https://yce-us.s3-accelerate.amazonaws.com.evil.test/a', 'https://user:pass@yce-us.s3.amazonaws.com/a', 'https://yce-us.s3.amazonaws.com:444/a']) assert.throws(() => storageURL(url));
});
test('provider HTTP failures and unknown result schema fail closed without leaking response', async () => {
  let count = 0;
  const client = new YouCam('secret', true, (async () => { count++; return new Response('private upstream diagnostic', { status: 429 }); }) as typeof fetch);
  await assert.rejects(client.create('a', 'b'), /PROVIDER_REQUEST_FAILED/); assert.equal(count, 1);
  const bad = new YouCam('secret', true, (async () => new Response(JSON.stringify({ status: 200, data: { task_status: 'unknown' } }))) as typeof fetch);
  await assert.rejects(bad.poll('x'), /PROVIDER_INVALID_RESPONSE/);
});
