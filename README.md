# Reconsider

**See the replacement before deciding what to do with a return.** Reconsider is a hackathon prototype for apparel shoppers who are uncertain about a style. It connects a reason for returning an item to eligible alternatives, a visual comparison, a server-calculated price difference, and an explicit sample exchange or refund decision.

[Try the public judge demo](https://reconsider-tan.vercel.app/) · [Read the submission description](docs/submission-draft.md) · [Inspect verification evidence](evidence/verification.txt)

## The YouCam integration

Perfect Corp's **YouCam Clothes V4** is the visual engine behind the comparison. The local TypeScript backend implements the real API workflow in `src/youcam.ts` and `src/jobs.ts`:

1. A shopper supplies a JPEG/PNG photo with explicit upload consent. The backend validates and normalizes it, removes image metadata, and keeps the API key server-side.
2. After separate consent to send the image to YouCam, a bounded job uploads the shopper image and merchant garment reference through YouCam's File API.
3. The job creates a `cloth-v4` task for `upper_body` with strict multi-person filtering, polls for completion, and exposes the result only to the owning session while it remains valid.
4. The result appears beside the garment reference. It helps compare **appearance**; it does not predict size, fit, garment condition, or merchant acceptance.

Three actual Clothes V4 tasks succeeded with synthetic inputs: the same synthetic shopper wearing a cobalt V-neck, a terracotta round-neck, and a forest-green collared blouse. Their recorded outputs are bundled so anyone can evaluate the visual decision without an API key or new API charges. The public Vercel demo **does not call YouCam when a visitor switches looks**. Its recorded results are visibly labeled. The first historical task ran with TLS certificate validation disabled by an inherited development setting; the two later tasks succeeded with TLS validation enabled. See the [sanitized evidence](evidence/verification.txt) and [provider documentation](https://docs.perfectcorp.com/reference/ai_clothes/v4.0/paths/~1s2s~1v2.0~1task~1cloth-v4/post).

Automated tests mock provider HTTP to cover the upload/task/poll contract and failure cases. Those tests are separate from the three real tasks. No further provider units are required to run the judge demo.

## What the demo does

- **Style concern:** shows three in-stock sample alternatives, each with a garment image and matching recorded YouCam result. Selecting a look checks the price difference and creates a ten-minute quote. The image switches immediately while the quote is checked.
- **Size or fit:** explains that a virtual try-on cannot verify fit, then offers a sample refund decision rather than suggesting an unsupported size change.
- **Damaged item:** explains that a retailer must assess the damage; the demo offers a sample refund decision and does not pretend the image diagnoses damage.
- **Other reason:** gives a clear sample refund route without requiring a photo.

The shopper can save an exchange or refund **decision**. The public site uses a signed, isolated sample session and keeps its decision history only in the current browser tab. The separately runnable Fastify/SQLite application persists sample requests locally and contains the consent-gated live YouCam adapter. Neither version places an order, charges or refunds money, reserves stock, contacts a retailer, or arranges fulfillment. Merchant impact and real-shopper performance have not been measured.

## Run locally

Requires Node.js 24.x, npm, and a writable local disk. From the repository root:

```powershell
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm run seed
npm run build
npm start
```

Open `http://127.0.0.1:3100/` and choose **Start the guided demo**. The guest path creates a new sample order and cannot upload images or spend YouCam units. Keep `YOUCAM_ENABLED=false` for this recorded-look walkthrough. On macOS/Linux, use `test -f .env || cp .env.example .env` instead of the PowerShell copy command.

`npm run seed` also writes short-lived Alice/Bob API tokens to ignored `demo-access.json` for command-line testing; they are not needed in the browser UI. `GET /health` is public, while `/v1` routes require a bearer token. Guest-session creation is enabled automatically only on the loopback bind. The local server is a prototype, not a public multi-tenant service.

To exercise stale-quote protection locally, quote `v-neck`, then run `npm run catalog:stock -- v-neck 0` before confirmation. The server rejects the stale quote. Restore with `npm run catalog:stock -- v-neck 3` and generate a fresh quote.

## Optional live API path

A live run can use API units and requires a licensed garment reference, a consented shopper photo, and a configured key. Keep the key only in ignored `.env` as `YOUCAM_API_KEY`; never commit it. First run the offline preflight, which makes **no** YouCam request:

```powershell
npm run integration:check -- C:\path\garment.jpg C:\path\shopper.jpg
```

Import a suitable garment reference with `npm run catalog:image -- v-neck C:\path\garment.jpg`. When an authorized live run is intended, set `YOUCAM_ENABLED=true` locally, use a non-guest authenticated session, upload the shopper image with `X-Image-Consent: true`, and separately consent when creating a preview job. The worker limits attempts and polling, avoids automatic retry after an ambiguous task-creation POST, and expires local image/result access. The public judge deployment does not expose this path or the key. No additional live run is part of the current submission plan.

## Architecture and safeguards

| Component | Responsibility |
|---|---|
| Public Vercel function, `api/handler.ts` | Signed sample sessions, simulated catalog, server-calculated quotes, recorded-only flow; no provider credentials or persistent merchant records |
| Local Fastify API, `src/app.ts` | Authenticated orders, reason routing, quote/request checks, image consent, and owner-qualified access |
| Local SQLite domain and worker, `src/domain.ts`, `src/jobs.ts` | Return-window, price, stock and version checks; idempotent decisions; bounded provider jobs |
| YouCam adapter, `src/youcam.ts` | Server-side File API upload, Clothes V4 task creation, and result polling |
| Browser view, `web/` | Three matching recorded looks, honest reason guidance, and clear sample decisions |

Local image uploads are re-encoded to JPEG with metadata removed. The server restricts remote storage hosts, applies per-user and global render limits, and does not automatically repeat a potentially accepted provider task after a timeout. Deletion tombstones dependent jobs but is not forensic erasure of SQLite pages or deletion of images already sent to YouCam. Production identity, merchant authorization, managed storage, payment, and fulfillment integrations remain outside this prototype.

## Verify

```powershell
npm run typecheck
npm run typecheck:hosted
npm test
npm run build
npm run build:hosted
```

The suite covers ownership, quote tampering, stale stock/price, duplicate decisions, non-style fallback, image consent and metadata handling, provider protocol with mocked HTTP, job limits, and hosted-session token integrity. The [verification log](evidence/verification.txt) distinguishes mocked checks, real synthetic provider results, and browser observations. The [submission map](docs/build-harness/12_submission-map.md) tracks the remaining Devpost actions.

## License and media

Code and documentation are [MIT licensed](LICENSE). Synthetic input images, recorded YouCam outputs, and project screenshots are [excluded from that grant](ASSETS.md) and included for evaluation. No real shopper photos or API credentials are committed. The required submission video is being produced separately by the entrant and is not part of this repository.
