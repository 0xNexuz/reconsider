import { Fault } from './domain.js';

export interface Provider {
  enabled: boolean;
  upload(bytes: Buffer): Promise<string>;
  create(source: string, reference: string): Promise<string>;
  poll(task: string): Promise<{ state: 'pending' | 'success' | 'error'; url?: string }>;
}
const origin = 'https://yce-api-01.makeupar.com';
export function storageURL(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !['yce-us.s3-accelerate.amazonaws.com', 'yce-us.s3.amazonaws.com'].includes(url.hostname)) throw new Fault(502, 'PROVIDER_URL_REJECTED');
  return url.href;
}
export class YouCam implements Provider {
  enabled: boolean;
  constructor(private key: string, enabled = false, private fetcher: typeof fetch = fetch) { this.enabled = enabled && !!key; }
  private async json(path: string, body?: unknown) {
    if (!this.enabled) throw new Fault(503, 'YOUCAM_NOT_CONFIGURED');
    let response: Response;
    try {
      response = await this.fetcher(origin + path, { method: body ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined, redirect: 'error', signal: AbortSignal.timeout(20000) });
    } catch { throw new Fault(502, 'PROVIDER_NETWORK_ERROR'); }
    if (!response.ok) throw new Fault(response.status === 429 ? 503 : 502, 'PROVIDER_REQUEST_FAILED');
    try {
      const payload = await response.json() as { status?: number; data?: any };
      if (payload.status !== 200 || !payload.data) throw new Error('shape');
      return payload.data;
    } catch { throw new Fault(502, 'PROVIDER_INVALID_RESPONSE'); }
  }
  async upload(bytes: Buffer) {
    const data = await this.json('/s2s/v2.0/file', { files: [{ content_type: 'image/jpg', file_name: 'image.jpg', file_size: bytes.length }] });
    const file = data.files?.[0];
    const put = file?.requests?.[0];
    if (typeof file?.file_id !== 'string' || put?.method !== 'PUT' || typeof put?.url !== 'string') throw new Fault(502, 'PROVIDER_INVALID_RESPONSE');
    const response = await this.fetcher(storageURL(put.url), { method: 'PUT',
      headers: { 'Content-Type': 'image/jpg', 'Content-Length': String(bytes.length) },
      body: new Uint8Array(bytes), redirect: 'error', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Fault(502, 'PROVIDER_UPLOAD_FAILED');
    return file.file_id as string;
  }
  async create(source: string, reference: string) {
    const data = await this.json('/s2s/v2.0/task/cloth-v4', { src_file_id: source, ref_file_id: reference, garment_category: 'upper_body', filter_multi_person: 'strict' });
    if (typeof data.task_id !== 'string' || !data.task_id) throw new Fault(502, 'PROVIDER_INVALID_RESPONSE');
    return data.task_id;
  }
  async poll(task: string) {
    const data = await this.json(`/s2s/v2.0/task/cloth-v4/${encodeURIComponent(task)}`);
    if (data.task_status === 'success') {
      if (typeof data.results?.url !== 'string') throw new Fault(502, 'PROVIDER_INVALID_RESPONSE');
      return { state: 'success' as const, url: storageURL(data.results.url) };
    }
    if (data.task_status === 'error') return { state: 'error' as const };
    if (!['pending', 'running', 'queued', 'processing'].includes(data.task_status)) throw new Fault(502, 'PROVIDER_INVALID_RESPONSE');
    return { state: 'pending' as const };
  }
}
