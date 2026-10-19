import sharp from 'sharp';
import { Fault } from './domain.js';

export async function normalizeImage(input: Buffer) {
  if (!input.length || input.length > 8 * 1024 * 1024) throw new Fault(413, 'IMAGE_SIZE_LIMIT');
  const jpeg = input.length >= 3 && input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff;
  const png = input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (!jpeg && !png) throw new Fault(422, 'INVALID_IMAGE');
  try {
    const metadata = await sharp(input, { limitInputPixels: 4096 * 4096 }).metadata();
    if (!['jpeg', 'png'].includes(metadata.format ?? '') || (metadata.pages ?? 1) !== 1 ||
      !metadata.width || !metadata.height || Math.min(metadata.width, metadata.height) < 384 ||
      Math.max(metadata.width, metadata.height) < 512 || Math.max(metadata.width, metadata.height) > 4096) throw new Error('unsupported');
    // Re-encoding removes EXIF/GPS and rejects malformed image data.
    return await sharp(input, { limitInputPixels: 4096 * 4096 }).rotate().resize({ width: 1536, height: 1536, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
  } catch { throw new Fault(422, 'INVALID_IMAGE'); }
}
