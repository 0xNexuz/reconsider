# Backend implementation status — 2026-10-19

This document records the implemented local prototype. Product validation and historical research remain unchanged. No production or submission readiness is asserted.

## Mechanisms

| Mechanism | Source | Status |
|---|---|---|
| Server authentication and ownership | src/app.ts, src/db.ts | Implemented; verification recorded separately |
| Policy filtering and authoritative quote | src/domain.ts, src/app.ts | Implemented; one item per demonstration order |
| Idempotent decisions | src/domain.ts | SQLite transaction plus unique order/key constraints |
| Image validation, metadata removal, expiry | src/images.ts, src/jobs.ts | Logical deletion; no secure-erasure claim |
| YouCam upload / V4 task / polling | src/youcam.ts | One live synthetic task SUCCEEDED; broader reliability UNVERIFIED |
| Durable jobs, budget and late-result suppression | src/jobs.ts | Implemented; single-process worker only |
| Merchant reference-image import | src/catalog-image.ts | Local CLI; no image rights assumed |
| Protected garment image retrieval | src/app.ts | Implemented; owner/order and active-stock gates tested locally |
| Offline image/config preflight | src/integration-check.ts | Implemented; makes no provider request and never prints the key |
| Isolated one-task live runner | src/live-one.ts | One successful synthetic run; explicit gate and one-job quota |
| Demonstration inventory updates | src/catalog-stock.ts | Local CLI; increments catalog version |
| Same-origin shopper page | web/, src/app.ts | Local desktop/mobile walkthrough verified through a persisted exchange request |
| Isolated guest demo | src/app.ts, web/app.js | One-click sample order; guest provider uploads/tasks denied; loopback default only |
| Submission text and demo shot plan | docs/submission-draft.md | Draft only; public video and judge-accessible URLs remain absent |
| Shopify / Loop / ReturnGO connectors | None | NOT IMPLEMENTED |
| Payments, inventory reservations, fulfillment | None | NOT IMPLEMENTED |

## Architecture and boundaries

Fastify → bearer-session ownership → deterministic policy → SQLite orders/quotes/requests. A single interval worker consumes durable jobs → YouCam REST API. Images are normalized locally and uploaded only after separate provider consent. Source bytes are held in SQLite for at most one hour; merchant references last 30 days. Result URLs have a local expiry. Deletion cannot revoke provider copies or previously disclosed URLs.

There are no production accounts or externally verified orders. Seeder-generated sessions are local demo credentials. CORS is not enabled; the shopper page uses same-origin routing. No arbitrary image URL fetch or external webhook ingress is exposed. API key never leaves the backend.

## Invariant mapping

- INV-01: authentication hook and owner-qualified SQL; cross-user order/image/preview tests.
- INV-02: strict input schemas and server arithmetic; monetary tamper test.
- INV-03: transaction plus unique order and user/idempotency constraints; concurrent replay test.
- INV-04: quote version, stock, currency, price, and window rechecked before persistence; stale-price/stock tests.
- INV-05: explicit queued/submitting/polling/succeeded/failed states; schema and timeout tests.
- INV-06: upload and provider consent gates; deleted job tombstones; in-flight result suppression test.

Actual execution results belong in evidence/verification.txt. Mocked provider execution is never evidence of a real YouCam render.

Verification completed: 20/20 tests passed after the guest-demo milestone; final TypeScript/build/smoke results are recorded in [verification](../../evidence/verification.txt). A browser walkthrough reached a persisted exchange receipt. One live synthetic YouCam task succeeded and produced a saved result, with a TLS limitation recorded in verification. Installation audit previously reported zero known vulnerabilities after upgrading sharp and restoring the Windows native dependency.

## Ranked remaining gaps

P0 / High for hackathon submission: entrant eligibility, a public/source-accessible repository and license, judge-accessible working build, public 1–3 minute video, and Devpost submission are incomplete. User approval is required for external publication and submission.

P0 / High technical caveat: one synthetic live result was inspected, but billing, provider retention, repeated-run reliability, and merchant demand have not been validated. The first run inherited disabled TLS certificate verification; the runner now clears that setting, but no second paid run has verified the fix in live transport. Rotate the key before future provider use.

P1 / High before public use: replace demo sessions with verified identity and merchant order authorization; isolate merchants; add encrypted managed storage and a tested retention policy; implement reservations/settlement only when merchant integrations exist. Do not expose this local prototype as a production return portal.

P1 / Medium: durable task submission cannot be exactly-once across an unknown provider POST outcome. Interrupted submissions fail instead of automatic retry. External processing may still finish and consume credits.

P2: merchant adapter, formal OpenAPI contract, distributed worker leases, and operational monitoring. P3: UI polish and expanded garment categories.

No exploitable critical defect has been established by this implementation pass; this is not an independent security audit. Overall engineering rating remains PARTIAL; full product rating UNVERIFIED.

## Next action

Use [the submission map](12_submission-map.md) and [draft](../submission-draft.md) to close the public repository, judging-access, video, eligibility, and rights gates. Keep the recorded result labeled; obtain fresh authorization before any further paid render or external release.
