> Implementation update: see [current backend status](implementation-status.md). The planning text below describes original targets; consult the status report and recorded tests for current evidence.

# Reusability

Status: PLANNED, P2. Candidate: a typed eligibility-and-quote module accepting trusted order, catalog, and policy inputs and returning eligible replacements plus reasons for rejection.

Potential interface: evaluateExchange(order, candidate, policy, inventorySnapshot). Its output should include currency, difference in minor units, policy version, and stock snapshot identifier. It must not promise reservation.

Keep this as an internal module first. Extract only after a second real consumer or adapter needs it. A tested example with no web UI dependency is more useful than a premature SDK, MCP server, or protocol. No package has been published, and no integration-time claim is supported.
