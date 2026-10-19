# Sponsor map

Track direction: eCommerce VTO. Essential sponsor: Perfect Corp. IMPLEMENTED capability: AI Clothes Virtual Try-On using locally normalized shopper and garment images. One live synthetic Clothes V4 task succeeded; [sanitized evidence](../../evidence/live-run-1792439336401.json) and [saved result](../../demo-assets/youcam-result-1792439336399.jpg) are available. The live run's TLS-verification limitation is documented in the evidence ledger.

Load-bearing test: disabling YouCam prevents personal replacement previews. It does not prevent ordinary return requests; that fallback is intentional.

Verification: the adapter's metadata/PUT/task/poll flow has mock HTTP contract tests. A real task returned an output with a synthetic shopper and product reference. The comparison UI displays that saved image with a recorded/synthetic label. A further live run requires new credit approval; do not expose private photos, task IDs, keys, or signed download URLs in public evidence.

Skin analysis is excluded from P0 because it adds no necessary value to this decision. No extra sponsor integrations are proposed. Special-prize access depends on genuine team eligibility, currently UNVERIFIED; prize stacking is not part of this strategy.
