const $ = id => document.getElementById(id);
const panels = ['connect', 'explore', 'compare', 'receipt'];
let token = '';
let order = null;
let quote = null;
let selected = null;
let providerAvailable = false;
let isGuest = false;
let candidates = [];
let hostedDemo = false;
let browserRequests = [];
let selectionRun = 0;
const productImages = new Map();
const productImageLoads = new Map();
const recordedLooks = {
  'v-neck': { name: 'Cobalt V-neck', url: '/demo/results/v-neck.jpg' },
  'round-neck': { name: 'Terracotta round-neck', url: '/demo/results/round-neck.jpg' },
  'collared': { name: 'Forest green collar', url: '/demo/results/collared.jpg' }
};
// Warm the three small, immutable recorded assets so switching looks does not
// wait for a quote request or a first-time image download.
const warmedLooks = Object.values(recordedLooks).map(look => { const image = new Image(); image.src = look.url; return image; });
const reasonGuidance = {
  style: { heading: 'Explore another look', detail: 'Compare eligible styles on the same synthetic shopper. A refund is still available.' },
  size: { heading: 'Fit needs different evidence', detail: 'A virtual try-on shows appearance, not whether another size will fit. This demo cannot verify sizing, so you can save a sample refund decision instead.' },
  damaged: { heading: 'A try-on cannot assess damage', detail: 'A retailer would need to review the item and order details. This demo cannot assess damage or arrange a replacement; you can save a sample refund decision.' },
  other: { heading: 'Choose a clear next step', detail: 'There is no supported visual recommendation for this reason. You can save a sample refund decision without uploading a photo.' }
};
const messages = {
  UNAUTHORIZED: 'That sample session has expired. Start a new guided demo.',
  REQUEST_ALREADY_EXISTS: 'This order already has a request. View its history below.',
  QUOTE_STALE: 'The item changed since you chose it. Find alternatives again for a fresh quote.',
  QUOTE_EXPIRED: 'The quote expired. Select the item again for a fresh quote.',
  YOUCAM_NOT_CONFIGURED: 'Live previews are disabled for this local demo. The recorded example remains available.',
  RENDER_BUDGET_EXHAUSTED: 'The daily preview limit has been reached. You can still request an exchange or refund.',
  DEMO_LIMIT: 'This demo has reached its session limit. Please try again later.',
  DEMO_NOT_SEEDED: 'The sample catalog is missing. Run npm run seed and reload.'
};
function notice(message, error = false) {
  const el = $('notice'); el.textContent = message; el.classList.toggle('error', error);
}
function show(name) {
  panels.forEach(panel => $(panel + '-panel').hidden = panel !== name);
  const index = panels.indexOf(name) + 1;
  document.querySelectorAll('.step').forEach(step => step.classList.toggle('active', Number(step.dataset.step) === index));
  notice('');
  $(name + '-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function money(cents, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}
function orderLabel() { return isGuest ? 'Sample order' : `Order ${order.id}`; }
async function api(path, options = {}) {
  const headers = { authorization: `Bearer ${token}`, ...options.headers };
  let response;
  try { response = await fetch(path, { ...options, headers, cache: 'no-store' }); }
  catch { throw new Error('The demo could not reach its server. Check your connection and try again.'); }
  if (!response.ok) {
    let body = {};
    try { body = await response.json(); } catch {}
    const error = new Error(messages[body.error] || body.error || `Request failed (${response.status}). Please try again.`);
    error.code = body.error; throw error;
  }
  return response.status === 204 ? null : response.json();
}
function imageFor(product) {
  if (productImages.has(product.id)) return Promise.resolve(productImages.get(product.id));
  if (productImageLoads.has(product.id)) return productImageLoads.get(product.id);
  const load = (async () => {
    if (hostedDemo && recordedLooks[product.id]) {
      const url = `/demo/garments/${product.id}.png`;
      productImages.set(product.id, url);
      return url;
    }
    if (product.preview_available) {
      try {
        const response = await fetch(`/v1/products/${encodeURIComponent(product.id)}/image`, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
        if (response.ok) { const url = URL.createObjectURL(await response.blob()); productImages.set(product.id, url); return url; }
      } catch {}
    }
    const fallback = product.id === 'v-neck' ? '/demo/blouse.png' : null;
    if (fallback) productImages.set(product.id, fallback);
    return fallback;
  })();
  productImageLoads.set(product.id, load);
  void load.then(() => productImageLoads.delete(product.id));
  return load;
}
function setBusy(button, busy, label) {
  button.disabled = busy;
  button.textContent = busy ? 'Working…' : label;
}
async function openOrder() {
    const [orders, health] = await Promise.all([api('/v1/orders'), api('/health')]);
    order = orders.data[0];
    if (!order) throw new Error('No demo order found. Run npm run seed first.');
    providerAvailable = !isGuest && health.youcam !== 'DISABLED';
    hostedDemo = health.persistence === 'BROWSER_SESSION';
    if (hostedDemo) {
      document.querySelector('.pill').textContent = 'JUDGE DEMO';
      $('demo-storage-note').textContent = 'This hosted demonstration keeps sample decisions in memory until this page is refreshed or closed. It uses recorded YouCam results and makes no new provider calls.';
      $('receipt-storage').textContent = 'This sample decision is visible here until you refresh or close the page. No retailer receives it.';
    }
    $('order-summary').textContent = `${orderLabel()} · ${money(order.paid, order.currency)} paid. Choose why you're returning it.`;
    $('original-price').textContent = `${money(order.paid, order.currency)} paid · original product photo not supplied`;
    $('live-preview-area').hidden = !providerAvailable;
    show('explore');
}
async function startDemo(event) {
  const button = event.currentTarget;
  const label = button.textContent;
  setBusy(button, true, label);
  try {
    const response = await fetch('/demo/session', { method: 'POST', cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(messages[body.error] || 'The guided demo is unavailable. Please try again later.');
    token = body.token; isGuest = true; quote = null; selected = null;
    browserRequests = [];
    $('reason').value = 'style';
    updateReasonUI();
    $('candidate-area').hidden = true;
    $('candidates').replaceChildren();
    $('history').replaceChildren();
    await openOrder();
  } catch (error) { notice(error.message, true); }
  finally { setBusy(button, false, label); }
}
async function findCandidates() {
  const button = $('find-button'); const label = button.textContent; setBusy(button, true, label);
  try {
    const reason = $('reason').value;
    const result = await api(`/v1/orders/${encodeURIComponent(order.id)}/candidates?reason=${encodeURIComponent(reason)}`);
    candidates = result.data;
    const container = $('candidates'); container.replaceChildren();
    $('candidate-area').hidden = false;
    $('candidate-heading').textContent = result.data.length ? 'ELIGIBLE REPLACEMENTS' : 'YOUR NEXT STEP';
    if (!result.data.length) {
      const guide = document.createElement('div'); guide.className = 'reason-guidance';
      const title = document.createElement('h4'); title.textContent = reason === 'style' ? 'No alternative is available right now' : reasonGuidance[reason].heading;
      const detail = document.createElement('p'); detail.textContent = reason === 'style' ? 'No eligible style is in stock for this sample order. You can still save a sample refund decision.' : reasonGuidance[reason].detail;
      guide.append(title, detail); container.append(guide); return;
    }
    for (const product of result.data) {
      const card = document.createElement('article'); card.className = 'candidate';
      const placeholder = document.createElement('div'); placeholder.className = 'candidate-placeholder'; placeholder.textContent = 'Loading product image…'; card.append(placeholder);
      const body = document.createElement('div'); body.className = 'candidate-body';
      if (recordedLooks[product.id]) {
        const badge = document.createElement('span'); badge.className = 'candidate-badge'; badge.textContent = 'Recorded try-on available'; body.append(badge);
      }
      const title = document.createElement('h4'); title.textContent = product.name;
      const detail = document.createElement('p'); detail.textContent = `Size ${product.size} · ${product.neckline} neckline`;
      const price = document.createElement('div'); price.className = 'price'; price.textContent = `${money(Math.abs(product.price - order.paid), product.currency)} ${product.price >= order.paid ? 'additional' : 'credit'}`;
      const choose = document.createElement('button'); choose.className = 'button outline'; choose.type = 'button'; choose.textContent = 'Compare this piece'; choose.addEventListener('click', () => select(product, choose));
      body.append(title, detail, price, choose); card.append(body); container.append(card);
      void imageFor(product).then(source => {
        if (!card.isConnected) return;
        if (!source) { placeholder.textContent = 'Product image not available'; return; }
        const img = document.createElement('img'); img.src = source; img.alt = `${product.name} product reference`; img.loading = 'eager';
        img.addEventListener('error', () => { if (img.isConnected) img.replaceWith(placeholder); placeholder.textContent = 'Product image unavailable. You can still compare this piece.'; });
        placeholder.replaceWith(img);
      });
    }
  } catch (error) { notice(error.message, true); }
  finally { setBusy(button, false, label); }
}
function updateReasonUI() {
  const reason = $('reason').value;
  $('reason-helper').textContent = reasonGuidance[reason].detail;
  $('find-button').textContent = reason === 'style' ? 'Find alternatives ↗' : 'Review next step ↗';
  $('refund-button').textContent = reason === 'style' ? 'Prefer a sample refund? Save that decision →' : 'Save a sample refund decision →';
  $('candidate-area').hidden = true;
  $('candidates').replaceChildren();
}
async function select(product, button) {
  const run = ++selectionRun;
  const label = button.textContent;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  quote = null;
  $('exchange-button').disabled = true;
  $('preview-button').disabled = true;
  $('quote-summary').textContent = `Checking ${product.name} price and availability…`;
  $('selected-name').textContent = product.name;
  $('selected-price').textContent = `${money(product.price, product.currency)} sample price`;
  const source = productImages.get(product.id);
  const refImage = $('reference-image');
  refImage.hidden = !source;
  if (source) { refImage.src = source; refImage.alt = `${product.name} product reference`; }
  let placeholder = $('reference-placeholder');
  if (!placeholder) { placeholder = document.createElement('div'); placeholder.id = 'reference-placeholder'; placeholder.className = 'reference-placeholder'; refImage.parentElement.append(placeholder); }
  placeholder.hidden = Boolean(source);
  placeholder.textContent = 'Product image not available for this item.';
  refImage.onerror = () => { if (run === selectionRun) { refImage.hidden = true; placeholder.hidden = false; placeholder.textContent = 'Product image unavailable. The price quote and decision remain available.'; } };
  if (!source) void imageFor(product).then(loaded => {
    if (run !== selectionRun || !loaded) return;
    refImage.src = loaded; refImage.alt = `${product.name} product reference`;
    refImage.hidden = false; placeholder.hidden = true;
  });
  const recorded = recordedLooks[product.id];
  $('result-figure').hidden = !recorded;
  $('comparison-disclosure').textContent = recorded
    ? 'This recorded YouCam result uses a synthetic shopper and this demo blouse. It is not a new preview of your photo. Appearance is not an exact-fit prediction.'
    : 'No recorded YouCam result exists for this item. You can still request the eligible exchange. Appearance is not an exact-fit prediction.';
  $('result-image').src = recorded?.url || '';
  $('result-image').alt = recorded ? `Recorded YouCam result: synthetic shopper wearing ${recorded.name}` : '';
  let resultFallback = $('result-fallback');
  if (!resultFallback) { resultFallback = document.createElement('div'); resultFallback.id = 'result-fallback'; resultFallback.className = 'reference-placeholder'; $('result-image').parentElement.append(resultFallback); }
  resultFallback.hidden = true;
  $('result-image').hidden = false;
  $('result-image').onerror = () => { if (run === selectionRun) { $('result-image').hidden = true; resultFallback.hidden = false; resultFallback.textContent = 'Recorded look unavailable right now. You can still review the garment and quote.'; } };
  $('result-caption').textContent = 'RECORDED YOUCAM RESULT • SYNTHETIC EXAMPLE';
  const switcher = $('look-switcher'); switcher.replaceChildren();
  for (const alternative of candidates) {
    const option = document.createElement('button');
    option.type = 'button'; option.className = 'look-option';
    option.textContent = recordedLooks[alternative.id]?.name || alternative.name;
    option.setAttribute('aria-pressed', String(alternative.id === product.id));
    option.addEventListener('click', () => { if (alternative.id !== selected?.id || !quote) select(alternative, option); });
    switcher.append(option);
  }
  $('preview-status').textContent = '';
  if ($('compare-panel').hidden) show('compare');
  try {
    const result = await api('/v1/quotes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId: order.id, productId: product.id, reason: 'style' }) });
    if (run !== selectionRun) return;
    quote = result.data; selected = product;
    $('quote-summary').textContent = `${product.name} · ${money(Math.abs(quote.difference), order.currency)} ${quote.difference >= 0 ? 'additional' : 'credit'} · Quote valid for ten minutes.`;
    $('exchange-button').disabled = false;
    $('preview-button').disabled = false;
  } catch (error) { if (run === selectionRun) { show('explore'); notice(error.message, true); } }
  finally { button.disabled = false; button.removeAttribute('aria-busy'); button.textContent = label; }
}
async function livePreview() {
  const file = $('photo').files[0];
  if (!file) return notice('Choose a JPEG or PNG photo first.', true);
  if (!$('provider-consent').checked) return notice('Confirm consent before sending an image to YouCam.', true);
  const button = $('preview-button'); setBusy(button, true, 'Generate a live preview');
  try {
    const upload = await api('/v1/images', { method: 'POST', headers: { 'content-type': file.type, 'x-image-consent': 'true' }, body: file });
    const queued = await api('/v1/previews', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': `preview-${crypto.randomUUID()}` }, body: JSON.stringify({ quoteId: quote.id, assetId: upload.id, consent: true }) });
    $('preview-status').textContent = 'YouCam is preparing your preview. You can still choose a refund.';
    for (let i = 0; i < 31; i++) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      const job = (await api(`/v1/previews/${encodeURIComponent(queued.id)}`)).data;
      if (job.state === 'SUCCEEDED' && job.result_url) {
        $('result-figure').hidden = false; $('result-image').src = job.result_url;
        $('result-image').alt = 'Your new YouCam appearance preview';
        $('result-caption').textContent = 'NEW YOUCAM PREVIEW • APPEARANCE ONLY';
        $('comparison-disclosure').textContent = 'This new YouCam preview shows appearance, not exact size or fit. You still control the exchange decision.';
        $('preview-status').textContent = 'Your preview is ready.'; return;
      }
      if (['FAILED', 'EXPIRED', 'DELETED'].includes(job.state)) throw new Error('The preview could not be completed. You can still request an exchange or a refund.');
    }
    throw new Error('The preview is taking longer than expected. You can check again later or choose a refund.');
  } catch (error) { $('preview-status').textContent = error.message; }
  finally { setBusy(button, false, 'Generate a live preview'); }
}
async function decide(kind) {
  const button = kind === 'refund' ? $('refund-button') : $('exchange-button');
  const label = button.textContent; setBusy(button, true, label);
  try {
    const payload = kind === 'refund' ? { kind, orderId: order.id } : { kind, orderId: order.id, quoteId: quote.id };
    const result = await api('/v1/requests', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': `request-${crypto.randomUUID()}` }, body: JSON.stringify(payload) });
    if (hostedDemo) browserRequests.unshift(result.data);
    $('receipt-summary').textContent = kind === 'refund'
      ? `You chose a sample refund for the ${money(order.paid, order.currency)} original purchase. No money has moved.`
      : `You chose ${selected.name} instead of the original sample blouse. ${money(Math.abs(quote.difference), order.currency)} ${quote.difference >= 0 ? 'additional' : 'credit'} on the sample quote. No money has moved.`;
    show('receipt'); await history();
  } catch (error) {
    if (['QUOTE_STALE', 'QUOTE_EXPIRED'].includes(error.code)) show('explore');
    notice(error.message, true);
  } finally { setBusy(button, false, label); }
}
async function history() {
  try {
    const result = hostedDemo ? { data: browserRequests } : await api('/v1/requests');
    const area = $('history'); area.replaceChildren();
    for (const item of result.data) {
      const row = document.createElement('p');
      row.textContent = `Sample ${item.kind === 'exchange' ? 'exchange' : 'refund'} decision · ${new Date(item.created_at).toLocaleString()}`;
      area.append(row);
    }
  } catch (error) { notice(error.message, true); }
}
$('start-demo-button').addEventListener('click', startDemo);
$('new-demo-button').addEventListener('click', startDemo);
$('find-button').addEventListener('click', findCandidates);
$('reason').addEventListener('change', updateReasonUI);
$('refund-button').addEventListener('click', () => decide('refund'));
$('exchange-button').addEventListener('click', () => decide('exchange'));
$('back-button').addEventListener('click', () => show('explore'));
$('preview-button').addEventListener('click', livePreview);
document.querySelectorAll('[data-hero-look]').forEach(button => button.addEventListener('click', () => {
  const look = recordedLooks[button.dataset.heroLook];
  if (!look) return;
  $('hero-look-image').src = look.url;
  $('hero-look-image').alt = `Recorded YouCam result: synthetic shopper wearing ${look.name}`;
  document.querySelectorAll('[data-hero-look]').forEach(option => option.setAttribute('aria-pressed', String(option === button)));
}));
updateReasonUI();
