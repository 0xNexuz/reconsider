# Reconsider — Devpost entry draft

**Status:** copy prepared; Devpost submission status is unverified. The entrant's public video is hosted on YouTube, not in this repository.

## Title and pitch

**Reconsider — see the replacement before you decide.**

When an apparel purchase feels wrong, shoppers often choose between an unseen alternative and a refund. Reconsider connects a style-related return to eligible replacements, a YouCam-powered visual comparison, an authoritative price quote, and a clear sample decision.

## Inspiration

A return is not always about a defective product. Sometimes the piece simply does not feel right. A product listing can show another blouse, but it cannot show the same shopper wearing each alternative. We built Reconsider to make that comparison more concrete at the moment a shopper is deciding what to do next.

## What it does

The public [judge demo](https://reconsider-tan.vercel.app/) starts a fresh sample order. For a style concern, it shows three available garments, each with a product reference image and a matching **previously recorded real YouCam Clothes V4 result** on the same synthetic shopper. Switching garments changes the visual immediately while the server checks a new ten-minute price quote. The comparison shows the original sample purchase and selected garment side by side in text, with the paid price and quote difference. The shopper can then save a sample exchange or refund decision.

For size/fit, damage, and other reasons, the app gives reason-specific guidance and a sample refund path. It does not present a virtual try-on as evidence of fit or damage. The catalog, order, and decisions are demonstration data. The public site keeps decision history in browser memory only until page refresh or close. No retailer receives the decision; no payment, refund, reservation, or fulfillment occurs.

## How we built it and used YouCam

The locally runnable application uses TypeScript, Node 24, Fastify, SQLite, sharp, and a browser UI. Its server-side YouCam adapter uploads a consented shopper photo and merchant garment reference through the File API, creates a Clothes V4 `upper_body` task with strict multi-person filtering, polls for completion, and exposes the result to the owning session. Jobs have bounded polling and quotas, and ambiguous task-creation failures are not automatically retried. Three live synthetic tasks succeeded and produced the cobalt, terracotta, and green recorded examples used in the public demo. The first historical task had disabled TLS certificate verification because of an inherited shell setting; the two later tasks verified TLS. Provider HTTP tests are mocked and identified separately from those real tasks.

The public Vercel build uses signed sample sessions, a simulated catalog, server-calculated quotes, and the three saved YouCam outputs. It deliberately cannot initiate new provider jobs or consume API units. The repository includes the full locally runnable integration, setup instructions, tests, and sanitized evidence.

## What we learned and what comes next

YouCam's visual result is useful for comparing appearance, but it is not a fit prediction. A responsible return flow must keep that distinction clear and must not imply that saving a demo decision changes a real order. Merchant demand, exchange conversion, multi-shopper quality, and production reliability remain unmeasured. A real merchant pilot would need identity, order authorization, inventory reservation, retention controls, and fulfillment integration.

## Submission links and media

- **Working app:** [https://reconsider-tan.vercel.app/](https://reconsider-tan.vercel.app/)
- **Public code:** [https://github.com/0xNexuz/reconsider](https://github.com/0xNexuz/reconsider)
- **Screenshots:** `submission/media/` contains revised hero, alternatives, and matching-comparison captures. Capture a fresh sample-decision screen before uploading screenshots to Devpost.
- **Public demo video:** [entrant-produced YouTube walkthrough](https://youtu.be/W_LDNskA_e8). Its page resolves publicly; independently check its duration and footage against the 1–3-minute rule before submitting.

The entrant confirmed registration and eligibility on October 20, 2026. The final Devpost form and legally binding submission terms still require their review. The [submission map](build-harness/12_submission-map.md) records the exact remaining actions.
