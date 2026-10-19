# Core invariants

These are implemented in the local backend and exercised by the 2026-10-19 automated suite. See [verification](../../evidence/verification.txt) for executed results; no production guarantee is implied.

| ID | Invariant | Enforcement and test |
|---|---|---|
| INV-01 | Only the order owner can view or request its return | Server authorization; two-account access tests — VERIFIED LOCALLY |
| INV-02 | Client-supplied money never determines a quote | Integer minor-unit calculation; tamper and boundary cases — VERIFIED LOCALLY |
| INV-03 | At most one request per demonstration order | Database transaction and unique state rules; concurrent submissions — VERIFIED LOCALLY |
| INV-04 | Stock and policy are checked at confirmation | Quote version plus revalidation; stale inventory case — VERIFIED LOCALLY |
| INV-05 | Failure cannot appear as a successful preview | Explicit job states; timeout and invalid-response cases — VERIFIED LOCALLY with MOCKED failures |
| INV-06 | Upload requires consent and deletion prevents local resurrection | Consent check and tombstone; late-result test — VERIFIED LOCALLY |

A quote is not a stock reservation unless an actual reservation mechanism is implemented. A request is not a fulfilled exchange. Test those distinctions in interface copy and receipts.
