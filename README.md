# Reconsider

A local API for reason-aware apparel exchanges: eligible replacements, trusted price quotes, optional YouCam previews, and explicit exchange/refund requests.

**Commerce is demonstration data.** A request does not charge/refund money, reserve stock, or ship a replacement. YouCam is disabled by default; there is no mock provider in the running application. Automated provider tests use mocked HTTP; one separately recorded synthetic live task succeeded.

One isolated YouCam Clothes V4 task using generated synthetic images succeeded on 2026-10-19. Its [recorded result](demo-assets/youcam-result-1792439336399.jpg) is a prior output, not a fresh render on every request. The first live runner inherited disabled TLS certificate checks from the shell; that runner has since been fixed, but no second paid task was submitted. See [verification](evidence/verification.txt).

## Run locally

Requires Node 24.x (uses Node's experimental built-in SQLite), npm, and a writable persistent disk. Run commands from this directory:

```powershell
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm run seed
npm run catalog:image -- v-neck demo-assets\synthetic-blouse.png
npm run build
npm start
```

Open the browser view at `http://127.0.0.1:3100/`. `GET /health` is public. All `/v1` endpoints require `Authorization: Bearer <token>`. Paste Alice's local demo token from ignored `demo-access.json` into the browser view; it is kept in tab memory. Seeding writes random 24-hour Alice/Bob tokens and only hashes are stored in the database. Seeding again rotates tokens but preserves existing requests. If an order already has a request, use a fresh local database or a new demonstration order; re-seeding does not erase it. Do not expose this prototype on the public internet: production identity, distributed rate limits, encryption-at-rest, and merchant integrations remain future work.

For the stock-change demonstration, run `npm run catalog:stock -- v-neck 0` after quoting that product. Confirmation will reject the stale quote. Restore with `npm run catalog:stock -- v-neck 3` and generate a fresh quote.

```powershell
$access = Get-Content .\demo-access.json | ConvertFrom-Json
$headers = @{ Authorization = "Bearer $($access.alice)" }
Invoke-RestMethod http://127.0.0.1:3100/v1/orders -Headers $headers
$quote = Invoke-RestMethod http://127.0.0.1:3100/v1/quotes -Method Post -Headers $headers -ContentType application/json -Body '{"orderId":"order-alice","productId":"v-neck","reason":"style"}'
$headers['Idempotency-Key'] = 'example-exchange-001'
$body = @{ kind='exchange'; orderId='order-alice'; quoteId=$quote.data.id } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:3100/v1/requests -Method Post -Headers $headers -ContentType application/json -Body $body
```

The sample quote difference is 500 USD cents. The response explicitly reports no payment execution or inventory reservation. A second request for the same order is rejected; replaying the same idempotency key and payload returns the original result. This prototype models one returnable item per order.

## YouCam integration

Before enabling paid calls, check a licensed garment photo and a consented shopper photo locally with `npm run integration:check -- C:\path\garment.jpg C:\path\shopper.jpg`. This command normalizes both in memory, reports only key presence and the enabled flag, and makes no YouCam request. It cannot establish that the pose, rights, or consent are suitable; review those separately. The key belongs only in this project's ignored `.env` file under `YOUCAM_API_KEY=`. Leave `YOUCAM_ENABLED=false` until the specific live-render run is authorized. Never paste the key into chat, source, screenshots, or logs.

1. Set `YOUCAM_API_KEY` in local `.env`, and `YOUCAM_ENABLED=true` only when ready for calls that may consume credits. Never commit this file.
2. Attach a licensed, front-facing upper-body garment image to a catalog product:
   `npm run catalog:image -- v-neck C:\path\licensed-blouse.jpg`
3. Create a fresh quote after importing the image (catalog changes invalidate old quotes).
4. Upload a consented photo as raw JPEG/PNG bytes to `POST /v1/images`, including `X-Image-Consent: true` and bearer auth. Images are validated, re-encoded to JPEG, and EXIF stripped. Accepted bounds: at least 512px long side and 384px short side, at most 4096px on either side, under 8 MiB.
5. `POST /v1/previews` with an idempotency header and `{"quoteId":"...","assetId":"...","consent":true}`. Consent here specifically covers transmission to YouCam; merely uploading locally does not transmit the photo.
6. Poll your `GET /v1/previews/:id`. The worker uploads source/reference bytes, submits `cloth-v4` with `upper_body` and strict multi-person filtering, then checks status every 10 seconds, at most 30 times.

Source references: [V4 task API](https://docs.perfectcorp.com/reference/ai_clothes/v4.0/paths/~1s2s~1v2.0~1task~1cloth-v4/post), [file/task workflow](https://docs.perfectcorp.com/reference/ai_clothes/section/overview). One synthetic live output was visually inspected, but broader quality, billing, regional storage hosts, and provider retention have not been verified. Storage destinations are restricted to two documented US S3 hosts; unknown hosts fail closed. Do not broaden the allowlist without verifying provider documentation.

Photos and result links expire locally after one hour. DELETE `/v1/images/:id` clears the local blob and tombstones dependent jobs, preventing late writes from restoring results. This is logical deletion, not forensic secure erasure of SQLite pages, WAL files, or backups. It does not delete data already sent to YouCam or revoke result links already copied by a user. There is no raw-photo serving endpoint.

Each render attempt counts toward persistent rolling-24-hour limits (default global 20 / user 5), including failed attempts. The worker never automatically repeats a task-creation POST after an ambiguous timeout or process crash. Interrupted submissions become `FAILED`; the user may explicitly start a new attempt, potentially spending credits again. Polling GET errors are retried within the fixed limit. Run exactly one server/worker instance per database; multi-process scheduling is not supported.

## API contract

| Method/path | Input / behavior |
|---|---|
| GET `/health` | Configuration status, never claims a live successful render |
| GET `/` and `/demo/*` | Public local shopper view and clearly labeled synthetic example assets; never expose a token or key |
| GET `/v1/orders` | Current user's orders |
| GET `/v1/orders/:id` | Owned order inside the 30-day demo policy |
| GET `/v1/orders/:id/candidates` | `reason=style`, optional `size`, `neckline`, `maxExtra` (minor units); up to three available products |
| GET `/v1/products/:id/image` | JPEG reference image for a catalog item when the shopper has an active order in the same currency; fetch with bearer auth and display as a local blob |
| POST `/v1/quotes` | `orderId`, `productId`, `reason: style`; 10-minute server quote |
| POST `/v1/requests` | `kind: exchange`, `orderId`, `quoteId`; or `kind: refund`, `orderId`; idempotency header required |
| GET `/v1/requests` | Owned persisted requests |
| POST `/v1/images` | Raw image + consent header; max five active images per user |
| DELETE `/v1/images/:id` | Owned image deletion and job tombstones |
| POST `/v1/previews` | Quote, image, explicit provider consent; idempotency header required |
| GET `/v1/previews/:id` | Owned job state, error, and temporary result URL on success |

No arbitrary remote URLs are accepted as image inputs. Client monetary fields and unknown JSON properties are rejected. Prices use integer minor units. Quotes revalidate price, currency, version, stock, return window, and existing request state at confirmation. Inventory availability is a snapshot; final merchant fulfillment must revalidate/reserve stock later. Size is a shopper preference, not a fit prediction.

Errors use `{ "error": "CODE" }`: 400 invalid input/consent, 401 unauthorized, 404 missing or not owned, 409 stale quote/already requested, 422 invalid image, 429 limit, 503 provider unavailable. Provider diagnostic bodies and API keys are not logged or returned.

## Verify

```powershell
npm run typecheck
npm test
npm run build
npm run smoke
```

Tests cover ownership, quote tampering, stale inventory/price, concurrent duplicate decisions, refund independence, expiration, image processing, late-result deletion, persistent quotas, bounded polling, and the provider wire contract. See [evidence](evidence/verification.txt) for recorded results and [current harness status](docs/build-harness/implementation-status.md).

No Shopify, Loop, or ReturnGO account has been connected. No user funds move. No project has been deployed or submitted. The local browser flow was tested through a persisted exchange receipt. The [Devpost draft](docs/submission-draft.md) and [submission map](docs/build-harness/12_submission-map.md) list the remaining public repository, judging access, video, eligibility, and rights gates.
The key stays in ignored `.env`; `YOUCAM_ENABLED=false` remains the resting configuration. Any additional live task requires renewed authorization because it may consume credits.
