# Reconsider — competition readiness (October 20, 2026)

The working judge demo is [public on Vercel](https://reconsider-tan.vercel.app/). This is not yet a submitted entry; see the [current submission map](build-harness/12_submission-map.md) for exact remaining actions.

## What is now demonstrable

- One synthetic shopper can switch among three distinct garments. Every catalog card has its own product reference; every comparison has the matching **recorded real YouCam Clothes V4 output**. The browser does not claim these are newly generated when a guest switches looks.
- A fresh guest order supports reason-based eligibility, server-calculated price differences, a new quote for each choice, a revalidated exchange request, or a refund request. Guest mode never submits a paid preview.
- The three successful provider runs are saved as images with sanitized local evidence. The first run had a TLS trust flaw; two later runs verified transport with the Windows system certificate store. The tests exercise provider protocol with mocked HTTP, not three more live calls.
- The three synthetic merchant references are bundled and installed by `npm run seed`. The repository's MIT grant excludes these images, as stated in [ASSETS](../ASSETS.md).

## Competitive benchmark and limits

The official [judging criteria](https://youcam-api-skin-ai-ecommerce.devpost.com/rules) weigh implementation, design, potential impact, and originality. The prior 2026 [CASTING](https://devpost.com/software/casting) project is an especially relevant bar for clearly labeled, genuine precomputed YouCam looks. [Aloud](https://devpost.com/software/aloud-lxqr70) and [KeepMe](https://devpost.com/software/keepme) show the value of a narrow end-to-end user job, accessible interaction, deterministic checks, and honest product limits. Reconsider now demonstrates those engineering choices locally. The 2026 current-event [project gallery](https://youcam-api-skin-ai-ecommerce.devpost.com/project-gallery) had no published competitors when last checked; no result for this event or 2025 predecessor is claimed.

No evidence yet proves merchant demand, reduced returns, higher exchange conversion, exact garment fit, multi-shopper quality, or production commerce processing. The result is a coherent hackathon demonstration, not a production return service.

## Historical pre-deployment action list (superseded)

The checklist below was written before the Vercel deployment and 96-second walkthrough. For the current status, use the [submission map](build-harness/12_submission-map.md).

1. **Publish this tested revision to the existing public GitHub repository.** This is a separate push boundary. Recheck the committed tree for `.env`, tokens, local database, dependencies, and build output; push only after authorization, then verify the remote SHA and three images.
2. **Make the working build accessible to judges.** Choose and approve a hosting destination and its cost/access policy. The present loopback demo cannot be opened by judges remotely. Before public exposure, replace the seed/guest bearer model with an intentionally scoped judge demo, assess storage and rate-limit behavior in that environment, keep `YOUCAM_ENABLED=false` by default, and test from an external browser. Hosting and access changes require approval.
3. **Verify entrant and asset eligibility.** The entrant must confirm event registration, geographic/team eligibility, and their right to publish the generated inputs and recorded YouCam outputs under the applicable event and provider terms. Code is MIT; demo images are excluded from that license.
4. **Capture final screenshots and align submission claims.** Show all three eligible options, a selected before/after comparison with the recorded/synthetic label, an exchange receipt, and a refund path. Remove any claim of payment, fulfillment, fit prediction, or new provider calls in guest mode. The written [Devpost draft](submission-draft.md) must point to the final deployed behavior.
5. **Submit the Devpost entry before the official deadline.** Fill the working build URL, public repository URL, screenshots, team details, and other required fields. This is a separate external submission approval boundary. The required public 1–3 minute video remains outstanding but is intentionally excluded from this list's execution scope.

The working build and submission cannot be called complete while steps 1–5 remain. Additional live API credits are not needed for this three-look recorded demo and are not authorized.
