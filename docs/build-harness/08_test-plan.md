# Test plan

Status: EXECUTED LOCALLY for the core prototype; broader product and production behavior remain UNVERIFIED. Exact prior results are in [verification](../../evidence/verification.txt).

| Check | Current evidence | Remaining |
|---|---|---|
| Authorization, quote arithmetic, stock/version revalidation, concurrent idempotency | Automated backend tests, 19/19 suite on 2026-10-19 | Production identity and merchant authorization |
| Image consent, normalization, local deletion, quota and late-result suppression | Automated tests | Provider-side retention and erasure |
| YouCam file/task/poll wire contract | Mock HTTP tests plus one real synthetic successful task | Repeatability and secure transport validation after TLS safeguard fix |
| Browser end-to-end exchange | Actual local browser: Bob order → candidates → quote/comparison → persisted REQUESTED receipt | Public judging access, independent reproduction |
| Mobile responsive behavior | 375px browser inspection and step-navigation fix | Keyboard/screen-reader and cross-browser check |
| Refund path | Automated backend test; UI control implemented | Browser walkthrough and demo footage |
| Compiled server | Build and prior real-HTTP smoke test | Public deployment/test-build check |

Before public release, retest from a clean checkout with `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run smoke`; inspect at desktop and mobile widths; verify image labels and no token/key in screenshots. Do not rerun paid YouCam without a new authorization. Independent merchant/user testing, slow-network recovery, and accessibility review remain to be done.
