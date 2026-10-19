# Threat model

Status: local prototype defenses IMPLEMENTED and tested; no production security guarantee or independent audit.

Assets: shopper photographs, orders, API credentials, catalog integrity, exchange credit, and request history. Actors: malicious visitors, other shoppers, compromised merchant accounts, and malfunctioning external services.

| Abuse case | Current defense | Verification |
|---|---|---|
| Read another shopper's order or image | Object ownership checked server-side | Cross-account requests denied |
| Tamper with displayed credit | Server recomputes from trusted order data | Alter browser price fields |
| Replay confirmation | Idempotency key and uniqueness constraint | Concurrent duplicate posts |
| Drain API units | Per-account limits and bounded job creation | Retry and concurrency tests |
| SSRF via image URL | Managed uploads and restricted outbound retrieval | Private-IP and redirect inputs |
| Re-create deleted image via delayed callback | Tombstone jobs and reject late writes | Delete while rendering |

Current tests cover ownership, quote tampering, duplicate decisions, quotas, malformed images, URL allowlisting, and late results after deletion. The UI uses text-only DOM insertion for untrusted catalog fields, a restrictive CSP, explicit provider consent, and clear recorded-output labels. Keys and signed URLs must stay out of logs; uploaded photos are re-encoded without metadata. Deletion covers local blobs/job results but cannot revoke provider copies or a previously disclosed signed URL. Generated images may distort garments or appearance. No exact-fit, fairness, privacy-compliance, or fraud-prevention certification is claimed.

The first live task inherited `NODE_TLS_REJECT_UNAUTHORIZED=0`; the one-off runner now removes this unsafe setting before network traffic, but no second paid task has verified the fix live. The key should be rotated before further use. Public exposure is blocked on production authentication, merchant authorization, storage controls, and deployment review; this local prototype must not be presented as a production return portal.
