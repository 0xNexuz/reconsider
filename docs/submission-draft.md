# Reconsider — Devpost draft (not submitted)

## Title and short pitch

**Reconsider — See the replacement before you choose it.**

An apparel return often begins with uncertainty about style rather than a broken product. Reconsider turns that moment into a clearer choice: it checks eligible alternatives for a return reason, shows a YouCam Clothes V4 appearance preview, revalidates price and stock, and records an explicit exchange or refund request.

## What it does

A shopper opens an order, chooses why the item is being returned, and sees in-stock, same-currency alternatives for a style-related return. Selecting a replacement creates a ten-minute server-calculated quote. The comparison view shows the product reference and a clearly labeled **recorded synthetic YouCam result**. When live YouCam is configured and the shopper separately consents, the app can upload a photo, create a Clothes V4 task, poll it, and show that shopper's result. The shopper may then request the exchange; stock, catalog version, price, currency, return window, and prior request state are checked again before the request is stored. A standard refund request remains available without image upload or YouCam.

The current merchant catalog and orders are **simulated**. Exchange/refund requests are persisted locally, but no payment, reservation, shipping, or refund execution occurs. Appearance preview is not a size or fit prediction.

## How we built it

The application uses Node 24, TypeScript, Fastify, Node SQLite, sharp, and a responsive browser view. The server owns policy and money calculations, normalizes photos to JPEG without metadata, stores expiring local assets, and queues bounded render jobs. The YouCam adapter uploads source and garment images through the File API, creates a Clothes V4 task, and polls for the result. Idempotency keys and database constraints prevent duplicate return requests; interrupted task creation is not automatically retried because the external POST may have been accepted and may use units.

One live Clothes V4 task with generated synthetic images **succeeded** on October 19, 2026, and the output was saved and visually inspected. Its first run inherited disabled TLS certificate verification from the development shell; the runner has since been fixed, but no second paid task was submitted. Mock HTTP contract tests and the local browser flow provide additional, separately labeled evidence.

## Why it matters

Conventional return flows can list replacements, but a shopper making a style decision still has to guess how one will look. Reconsider joins the reason, eligible alternatives, personal visualization, and a revalidated choice in one flow. Merchant value is a hypothesis; no interviews, return-rate change, or sales lift has been measured.

## Demo video plan (target 2:20, public upload pending)

Use actual screen footage from the local browser view; show the recorded image only with its visible label. Do not narrate the recorded image as a new render. Do not show the API key, local bearer token, signed URL, or terminal history containing them.

| Time | Footage | Narration point |
|---|---|---|
| 0:00–0:15 | Hero and return problem | “A style return is often a decision made without seeing the alternative.” |
| 0:15–0:38 | Click Start the guided demo; select style | “Reconsider starts from an isolated sample order and the shopper's reason.” |
| 0:38–0:58 | In-stock alternatives and price difference | “Eligibility and differences come from the server, not browser-entered prices.” |
| 0:58–1:23 | Product reference beside labeled recorded result | “YouCam Clothes V4 powers the visual comparison. This example was generated in one earlier synthetic live run.” |
| 1:23–1:43 | Request exchange and receipt | “The quote is rechecked; the request is stored, but nothing is charged or shipped.” |
| 1:43–2:00 | Fresh order or edited footage of refund path | “A standard refund remains available without sending a photo.” |
| 2:00–2:20 | Code/evidence view and closing | “One real API task succeeded; the local tests cover ownership, stale stock, and duplicate requests. Merchant impact remains to be validated.” |

If showing the stale-stock failure, start a fresh guest order after restoring stock; never splice UI footage so it falsely implies a single uninterrupted successful flow.

## Submission fields still to fill

- **Code repository URL:** [https://github.com/0xNexuz/reconsider](https://github.com/0xNexuz/reconsider) — public source with MIT code/documentation licensing and an explicit demo-image exclusion.
- **Working project/test access URL or test build:** BLOCKED — no deployment or distributable test link yet. Judges must have access through the judging period.
- **Public YouTube/Vimeo 1–3-minute video URL:** BLOCKED — no video recorded or uploaded.
- **Screenshots:** to capture from the tested local browser flow, with visible real-versus-demo labels.
- **Entrant registration, eligibility, team representation, special-award eligibility:** UNVERIFIED — the entrant must confirm.
- **Third-party rights:** generated demo imagery and project code need a final rights/license review before public release; no copyrighted music or outside trademarks are planned.
- **Significant update after September 29, 2026:** implementation and live synthetic test occurred October 18–19, 2026; cite the final repository history once published.

Do not paste credentials, signed URLs, or private images into the Devpost form. Do not submit this draft until every BLOCKED field is resolved and the live/test claims match the actual accessible build.
