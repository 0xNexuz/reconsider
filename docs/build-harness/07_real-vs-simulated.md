> Implementation update: see [current backend status](implementation-status.md). The planning text below describes original targets; consult the status report and recorded tests for current evidence.

# Real versus simulated

| Capability | Current status | Planned demonstration |
|---|---|---|
| YouCam preview | ONE LIVE SYNTHETIC RUN SUCCEEDED | Saved recorded output; broader reliability unverified |
| Eligibility and quote engine | VERIFIED LOCALLY | Actual local/server code |
| Merchant orders and stock | SIMULATED | Explicitly labeled seeded demonstration data |
| Exchange/refund request | VERIFIED LOCALLY | Persisted request in demo database; no fulfillment |
| Payments and logistics | NOT IMPLEMENTED | No execution claimed |
| Merchant connector | NOT IMPLEMENTED, optional | Add only if authenticated and tested |
| Commercial impact | UNVERIFIED | Pilot required |

No product execution occurred during research; subsequent backend work includes one genuine YouCam Clothes V4 task using synthetic images, recorded on 2026-10-19. That first run inherited disabled TLS certificate verification, which is a limitation of its evidence. A demonstration inventory change is a SIMULATED retail event even when the rejection logic is real. The captured provider image must be labeled recorded output. A mock response must never be shown as a new live render.
