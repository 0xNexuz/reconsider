# Project Context

Last updated: 2026-10-19 (Africa/Lagos). Source of truth for continuation, with implementation details in [README](../README.md) and [backend status](build-harness/implementation-status.md).

## Project identity and Git state

- **Project:** Reconsider, a visual exchange desk for apparel returns. The selected idea is APPROVED through the user's October 18 request to begin backend and integrations.
- **Directory:** repository root.
- **Git:** `main` tracks public [0xNexuz/reconsider](https://github.com/0xNexuz/reconsider). The initial public push was verified against the remote HEAD on 2026-10-19. No PR is claimed; check Git state on continuation.
- **Current stage:** local SUBMISSION PREPARATION and READINESS. Overall product status: PARTIAL; not submission-ready.

## Hackathon and strategic decisions

- **Event:** YouCam API Skin AI & eCommerce VTO Hackathon, Perfect Mobile Corp. [Official rules](https://youcam-api-skin-ai-ecommerce.devpost.com/rules) and [schedule](https://youcam-api-skin-ai-ecommerce.devpost.com/details/dates).
- **Deadline:** November 2, 2026, 11:45 a.m. EST / 5:45 p.m. Africa/Lagos. Recheck before submission. Personal eligibility and registration are UNVERIFIED.
- **Direction:** reason-aware apparel exchanges. An appearance-related return leads to eligible alternatives, a personal YouCam preview, stock/price revalidation, and an explicit exchange or refund request.
- **Why:** specific shopper and merchant decision with a short demo and load-bearing YouCam VTO. Alternative bridal and capsule-wardrobe concepts had closer historical overlap. Research lives in [recommendation](../research-and-recommendation.md).
- **Non-goals for the prototype:** exact size prediction, automated purchase/refund, shipping, cross-merchant catalog scraping, and medical/skin claims.

## Architecture and authorization

- **Stack:** TypeScript/Node 24, Fastify, Node SQLite, sharp, Zod. Local default binding `127.0.0.1`.
- **State:** demo orders/catalog, server-side quotes, idempotent requests, normalized images, durable render jobs. User bearer sessions are seeded locally and valid 24 hours.
- **Provider:** server-only YouCam Clothes V4 adapter. The user added a key locally; `YOUCAM_ENABLED=false` remains in `.env`. One isolated run was explicitly authorized by “you can handle the rest” and completed. Do not repeat a paid run without fresh authorization.
- **Approved scope:** backend and integrations, local implementation/testing/submission preparation, and publication of this GitHub source repository. No app deployment, demo-video publication, Devpost submission, or credential disclosure is authorized. A further provider run is a new cost boundary.
- **Trust limits:** sample commerce data is SIMULATED. No merchant account, payment, inventory reservation, or fulfillment integration exists. Provider wire behavior is MOCKED in tests; one live render with SYNTHETIC images succeeded.

## Verified milestones and evidence

| Milestone | Status | Evidence |
|---|---|---|
| Authenticated order and candidate API, authoritative quote, exchange/refund requests | VERIFIED locally | Prior 15/15 tests and compiled HTTP smoke test, recorded in [verification](../evidence/verification.txt) |
| Image consent, validation, local expiry/deletion, render quota and job lifecycle | VERIFIED locally; provider MOCKED | Same recorded tests |
| YouCam upload/task/poll adapter | VERIFIED for one synthetic live run; broader reliability UNVERIFIED | One task succeeded and returned a saved image; [sanitized run record](../evidence/live-run-1792439336401.json) |
| Shopper retrieval of merchant garment reference image | VERIFIED locally | Full 16/16 suite includes authentication, ownership, stock, and byte-response checks; see [verification](../evidence/verification.txt) |
| Offline integration preflight | VERIFIED locally | Local image normalization and redacted key-presence check; full suite 17/17, typecheck and build passed |
| Same-origin shopper view | VERIFIED locally | One-click isolated guest order, candidate selection, recorded comparison, quote, and persisted exchange receipt. Latest suite 20/20; see [verification](../evidence/verification.txt) |
| Submission copy and shot plan | DRAFTED locally | [Draft](submission-draft.md) and [submission map](build-harness/12_submission-map.md); no video or public URL yet |

The previous installation audit found zero known vulnerabilities after the sharp update. That is a historical command result, not a continuing security guarantee.

## Priorities and blockers

- **P0 for submission:** public source repository with MIT code/documentation licensing is DONE. Verify entrant eligibility and registration; provide a judge-accessible working build; record and publish a public 1–3 minute demo video; submit the Devpost entry before the deadline. Those remaining external steps require approval.
- **P0 technical caveat:** one synthetic live YouCam render succeeded and was visually inspected. Billing, provider retention, repeated-run reliability, and merchant demand remain unverified. Rotate the key before further provider use because the prior live run inherited disabled TLS verification.
- **P1:** production identity, merchant authorization, image storage/retention, and a real commerce adapter are needed before public use. These are outside the current local prototype.
- **P2:** formal API contract and a reusable quote module after a second adopter exists.
- **P3:** additional garment categories or visual polish.

## Decision log

### 2026-10-18 — Select Reconsider

- **Decision:** APPROVED for backend implementation after research; focus on appearance-driven returns and visual replacement decisions.
- **Evidence:** hackathon research and historical project comparison in the recommendation.
- **Impact:** one merchant, upper-body catalog, deterministic eligibility, real YouCam dependency, honest refund fallback.

### 2026-10-18/19 — Local backend milestone

- **Decision:** IMPLEMENTED Fastify/SQLite prototype and server-only provider adapter. Demo commerce remains SIMULATED and provider disabled by default.
- **Evidence:** [prior verification record](../evidence/verification.txt).
- **Impact:** safe local flow exists; live API and public release are not verified.

### 2026-10-19 — Protected garment image route

- **Decision:** Add a shopper-readable reference-image endpoint so the comparison view can retrieve the merchant photo already stored by the backend.
- **Evidence:** full 16/16 local test suite, TypeScript check, build, and real HTTP smoke test passed on 2026-10-19; details in [verification](../evidence/verification.txt).
- **Impact:** closes a core backend API gap without provider calls.

### 2026-10-19 — Offline integration preflight

- **Decision:** Add `npm run integration:check -- <garment-photo> <shopper-photo>` to validate local image acceptance and report only whether a key is present and YouCam is enabled.
- **Evidence:** full 17/17 suite, TypeScript check, and build passed; the preflight test covers valid and missing images plus secret redaction.
- **Impact:** image and configuration errors can be found without provider traffic. Visual suitability, rights, consent, billing, and live behavior remain unverified.

### 2026-10-19 — One live synthetic YouCam preview

- **Decision:** use generated synthetic shopper and product images for one isolated end-to-end provider run, with a one-job quota and no local demo database mutation.
- **Evidence:** one Clothes V4 task succeeded and its image was saved at `demo-assets/youcam-result-1792439336399.jpg`. The sanitized JSON record and narrative are in `evidence/`. The final code passes 18/18 tests, typecheck, and build.
- **Observation:** the result shows the cobalt blouse with visible V-neck and sleeves on the synthetic shopper. This is one visual inspection, not a demographic or reliability evaluation.
- **Security limitation:** the first live run inherited `NODE_TLS_REJECT_UNAUTHORIZED=0` from the shell, so transport certificate verification was disabled during that run. The live runner now clears this setting like the server; no second task was submitted. Do not treat the run as transport-security verification.

### 2026-10-19 — Same-origin shopper walkthrough and submission draft

- **Decision:** add a local browser view around the existing API and recorded synthetic YouCam result; keep paid previews disabled by default and clearly distinguish the recorded example from a current render.
- **Evidence:** browser walkthrough on desktop and mobile reached a persisted exchange receipt; public assets and protected API behavior are covered by the local test suite. [Submission draft](submission-draft.md) contains honest Devpost copy and a video shot plan.
- **Impact:** the core journey is demonstrable without additional API credits. Merchant order processing remains simulated.

### 2026-10-19 — Remove judge-facing token friction

- **Decision:** add an optional rate-limited guest session that creates an isolated sample order and a one-click browser entry. Guest sessions cannot upload images or create paid preview tasks, even when YouCam is configured. Loopback enables the route automatically; a non-loopback bind requires explicit configuration and release approval.
- **Evidence:** local tests include disabled-by-default behavior, guest isolation and expiry, and denial of provider endpoints; final browser walkthrough and command results are in [verification](../evidence/verification.txt).
- **Impact:** a judge can replay exchange/refund decisions without finding a bearer token or inheriting a used order. The recorded YouCam output remains a prior synthetic run, not a new render on each visit.

### 2026-10-19 — Public source repository authorized

- **Decision:** published the existing local source at [0xNexuz/reconsider](https://github.com/0xNexuz/reconsider). The user selected MIT for code and documentation while excluding demo images from that grant; [asset terms](../ASSETS.md) explain the distinction. The public `main` branch and expected source/asset files were verified; `.env`, demo tokens, database, dependencies, and build output were absent from the remote tree.
- **Boundary:** source publication only. A judge-accessible deployed app, public video, further API credits, and Devpost submission remain separate steps.

## Next action and boundary

The public source and license gate is complete. Next obtain user approval for judge-accessible hosting, public video upload, and Devpost submission. The user must verify eligibility and rights to the published assets. Assess whether the judging build needs an authorized, budgeted live-render path; any additional live render needs renewed cost approval. Keep the key only in ignored `.env`, with `YOUCAM_ENABLED=false` at rest.
