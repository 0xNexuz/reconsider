import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { normalizeImage } from './images.js';

const [garmentPath, shopperPath] = process.argv.slice(2);
if (!garmentPath || !shopperPath) {
  console.error('Usage: npm run integration:check -- <licensed-garment-image> <consented-shopper-image>');
  process.exitCode = 1;
} else {
  let valid = true;
  const images: [string, string][] = [['Garment', garmentPath], ['Shopper', shopperPath]];
  for (const [label, path] of images) {
    try {
      const normalized = await normalizeImage(readFileSync(path));
      const metadata = await sharp(normalized).metadata();
      console.log(`${label}: local image accepted (${metadata.width}x${metadata.height}, ${normalized.length} bytes after normalization)`);
    } catch {
      valid = false;
      console.error(`${label}: missing, unreadable, or unsupported image`);
    }
  }
  console.log(`YouCam key: ${process.env.YOUCAM_API_KEY ? 'present' : 'missing'}`);
  console.log(`YouCam enabled: ${process.env.YOUCAM_ENABLED === 'true' ? 'yes' : 'no'}`);
  console.log('No provider request was made. Visual suitability, image rights, and consent still require human review.');
  if (!valid) process.exitCode = 1;
}
