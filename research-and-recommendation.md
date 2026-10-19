# Reconsider — research and build recommendation

> Historical planning snapshot from 18 October 2026. Implementation and verification progressed afterward; see [project context](docs/PROJECT_CONTEXT.md) and [verification evidence](evidence/verification.txt) for current status.

Research date: 18 October 2026. Planning only. No application, API execution, user interviews, or performance tests have been completed. Brand name availability is UNVERIFIED.

## Verdict

Proceed to a two-day validation and API feasibility spike. Reconsider is a visual exchange desk for apparel merchants: shoppers returning an item because they dislike its style can preview eligible replacements on themselves, compare the actual price difference, and choose an exchange request or refund request. Its competitive advantage must come from completing this narrow decision reliably.

Strategic win-position estimate: **79/100**, not a win probability. Assumes one experienced full-stack builder with roughly two weeks available; actual builder availability is UNKNOWN. Submission readiness: NOT IMPLEMENTED. Mag engineering score: UNVERIFIED, because no repository was supplied or tested.

## Event facts

The [official rules](https://youcam-api-skin-ai-ecommerce.devpost.com/rules) require a working YouCam integration, repository access, English submission materials, an accessible test build, and a public 1–3 minute demo. New projects and significantly enhanced existing projects qualify. Adults, teams, and organizations can enter, subject to geographic and conflict exclusions; personal eligibility remains UNVERIFIED. No team-size cap was identified.

Awards are $2,500/$1,000/$500 for placements plus $1,000 each for Women in Tech and Rising Star. Special awards require, respectively, a qualifying woman team member or enrolled student with school-issued email. Only one prize per project. Four equally weighted criteria cover implementation, design, impact, and idea quality; implementation is the first tie-breaker.

The [schedule](https://youcam-api-skin-ai-ecommerce.devpost.com/details/dates) and rules agree on November 2, 11:45 a.m. EST: **5:45 p.m. Lagos time**. They disagree on the judging start date (November 9 versus November 3). Plan to keep the build available throughout November 3–20. Winners are scheduled around November 24. Target an internal submission freeze on October 31.

The [current gallery](https://youcam-api-skin-ai-ecommerce.devpost.com/project-gallery) is unpublished. Current submission count, serious-entry count, track density, and relative win rate are UNKNOWN. Registrations are not submissions.

## Historical evidence and counterexamples

| Event / entry | Observed result | What the public evidence supports |
|---|---|---|
| YouCam July–August 2026: [Aloud](https://devpost.com/software/aloud-lxqr70) | First place | A specific accessibility workflow for blind beauty shoppers, with voice and barcode interaction. |
| Same event: [KeepMe](https://devpost.com/software/keepme) | 3rd–5th place award | Shopper-controlled edits and checks for unwanted changes in generated try-on images. |
| Same event: [ConfidFit](https://devpost.com/software/confidfit) | Winner badge | Shopify try-on with merchant operations and explicit result labels. |
| Same event: [ClosetIQ](https://devpost.com/software/wardrobe-aura) | No winner badge on completed event page | Skin-aware wardrobe reuse and try-on; author explicitly lists persistent render caching and saved looks as future work. |
| Same event: [Before You Cut](https://devpost.com/software/before-the-cut) | No winner badge on completed event page | Garment design combinations and visualization; evidence that a specialized creative idea alone does not assure a prize. |
| DeveloperWeek 2026: CLOSET and FitCast | Winner badges in [official gallery](https://developerweek-2026-hackathon.devpost.com/project-gallery) | Wardrobe styling and weather-aware try-on have won before. Exact prize attribution was not verified. |
| SpectrumCircle Summer 2026: Curating Shop by CRISHIRTS | Winner reported by sponsor | Sponsor describes an integrated design-to-try-on-to-checkout journey in its [announcement](https://www.linkedin.com/posts/perfect-corp_youcam-perfectcorp-virtualtryon-activity-7480989944635805696-_5ow). Not independently audited. |

The [previous YouCam gallery](https://youcam-api.devpost.com/project-gallery) displays 238 entries and five winner badges. That is roughly 2.1% badge density, not a personal win probability or a count of valid judged entries. This was a targeted sample, not a full census. No repositories or demos were executed; project features are author descriptions. Public judging feedback explaining losses was not found. Absence of a badge supports a non-winning comparison within the event, not a claim that the project was poor.

INFERRED organizer preference: a clear consumer job, meaningful YouCam use, visible product completeness, and an understandable decision. Historical styling winners are counterevidence to any blanket assertion that generic categories cannot win.

## Saturation and ranked directions

Scores below are subjective estimates from observed overlap; lower saturation is better. Current-event overlap remains UNKNOWN.

| Direction | Saturation /100 | Win position /100 | Main reason / risk |
|---|---:|---:|---|
| Reconsider: reason-aware visual exchanges | 40 | 79 | Clear merchant/user decision and failure demo; merchant demand and API fidelity untested. |
| Group bridal fitting room | 80 | 64 | Strong visual demo, but [VOWS&VIBE](https://devpost.com/software/vows-vibe) already implements close functionality. |
| Buy-less capsule optimizer | 85 | 61 | Useful but crowded by ClosetIQ, [ClosetMind](https://devpost.com/software/closetmind), and [Talk Me Out of It](https://devpost.com/software/talk-me-out-of-it). |

Scoring weights: problem 15, differentiation 15, technical mechanism 10, sponsor/rubric fit 15, judge clarity/demo 15, feasibility 15, competitive/historical position 10, prize access 5. Reconsider receives 12+11+8+14+13+11+7+3=79. Other totals are comparative estimates, not measured performance.

## The actual product gap

[ReturnGO](https://support.returngo.ai/any-to-any-exchanges) already supports exchanging returned value for other products and settling the difference. [Loop](https://help.loopreturns.com/en/articles/1912321) supports advanced exchanges. Reconsider should not claim to invent exchanges, inventory filtering, or returns orchestration. The proposed wedge is reason-aware, personal visual comparison embedded at this decision point. The reviewed sources do not establish that every competitor lacks this capability.

Example journey: a shopper returns a blouse because the style is not what they wanted. They select a different sleeve or neckline preference. The system filters a merchant-owned catalog using declared size, availability, price cap, and policy. It offers at most three options, renders user-selected options through YouCam, and shows reference product photos beside generated previews. The shopper approves an exchange request or continues to a refund request.

The memorable mechanism is **reason → eligible alternatives → personal preview → revalidation → explicit decision**. A structured policy engine determines eligibility; a model may help interpret preferences but cannot alter policy, inventory, or credit. No LLM is necessary for the initial version.

Use [AI Clothes VTO](https://docs.perfectcorp.com/reference/ai_clothes/section/overview) for a small upper-body garment catalog. The documentation specifies image upload, task creation, polling, and returned result URLs. Version-specific input support and actual account costs must be checked in the spike. The sponsor [explicitly distinguishes appearance preview from exact sizing](https://www.perfectcorp.com/business/blog/ai-clothes/ai-clothes-changer-virtual-try-on-guide/). Route size-only, damaged-item, and non-visual complaints directly to appropriate return choices; never use a generated image as proof of fit.

## Build and validation plan

- **October 18–19:** interview three apparel merchants and five recent returners; test consented images against 10–15 licensed upper-body products. These are proposed targets, not completed research. Continue only if at least two merchants recognize the workflow and the tested API produces useful previews without material garment distortion in at least 80% of the small test set. This threshold is a project decision, not a general accuracy claim.
- **October 20–24, P0:** build one merchant catalog, authenticated seeded orders, return reasons, deterministic eligibility, real VTO, comparison, request persistence, and an equally accessible refund path. Seeded orders and inventory must be labeled demonstration data. No real money movement.
- **October 25–27, P1:** prove cross-user isolation, price recomputation, stale-stock rejection, duplicate-request protection, deletion, and bounded API retries. Test the flow with users and record time, errors, and preferences without claiming sales uplift.
- **October 28–30:** finish documentation, reproducible setup, responsive UI, evidence capture, and a 150-second demo. A merchant connector is optional only after P0 and P1 pass.
- **October 31:** freeze and prepare the submission; retain November 1–2 as contingency.

Commercial hypothesis: an embedded module sold to small apparel brands or licensed to return-platform vendors. Willingness to pay, integration access, exchange uplift, repeat returns, and unit economics are UNVERIFIED. A credible pilot measures completed voluntary exchanges and subsequent returns, not just preview clicks.

## Pre-judging and red team

Concept-only target scores: implementation 8/10, design 8/10, impact 7/10, idea 8/10, yielding 77.5/100 at equal weighting. These are achievable targets, not current judging scores. All current implementation evidence is missing.

Why this might lose: it could look like an existing exchange portal with a try-on button; generation may reproduce the disappointing garment incorrectly; synthetic commerce data weakens impact proof; shoppers may prefer the immediate refund. Fix by showing reason-specific filtering, honest visual limitations, a real merchant walkthrough, and recovery from an inventory change. Do not make the refund harder to select.

High-priority planning risks: no working sponsor call (P0), no demonstrated user demand (P0 decision gate), and no protected order boundary (P0 for any multiuser build). File/function findings are not applicable because no code was audited. Critical exploitable defects: UNKNOWN, not proven absent. Medium risk: API cost and latency. Low risk: naming and motion polish.

See [the planning harness](docs/build-harness/00_README.md) for architecture, invariants, tests, evidence, and submission gates. Exact next action: run the upper-body VTO spike and validate the exchange decision with merchants before building the full interface.
