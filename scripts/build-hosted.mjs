import { copyFileSync, mkdirSync } from 'node:fs';

function copy(from, to) {
  const destination = new URL(to, import.meta.url);
  mkdirSync(new URL('.', destination), { recursive: true });
  copyFileSync(new URL(from, import.meta.url), destination);
}

copy('../web/index.html', '../public/index.html');
copy('../web/app.js', '../public/demo/app.js');
copy('../web/styles.css', '../public/demo/styles.css');
copy('../demo-assets/synthetic-shopper.png', '../public/demo/shopper.png');
copy('../demo-assets/synthetic-blouse.png', '../public/demo/blouse.png');
copy('../demo-assets/synthetic-blouse.png', '../public/demo/garments/v-neck.png');
copy('../demo-assets/synthetic-round-neck.png', '../public/demo/garments/round-neck.png');
copy('../demo-assets/synthetic-collared.png', '../public/demo/garments/collared.png');
copy('../demo-assets/youcam-result-1792439336399.jpg', '../public/demo/recorded-result.jpg');
copy('../demo-assets/youcam-result-1792439336399.jpg', '../public/demo/results/v-neck.jpg');
copy('../demo-assets/youcam-result-1792459738608.jpg', '../public/demo/results/round-neck.jpg');
copy('../demo-assets/youcam-result-1792459818444.jpg', '../public/demo/results/collared.jpg');
console.log('Built recorded-only Vercel demo assets. No API credentials included.');
