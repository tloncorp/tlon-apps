# %groups-ui

Aggregates client initialization data and stores pin ordering and contact
suggestions.

## Retired public-page migration (state 4)

Initialization and upgrades from states 0–3 queue a Behn wake to clean up the
retired `%profile` and `%expose` agents. No scries occur during `on-load`.
The wake reads Eyre's cache and clears live entries whose parsed route starts
with `/profile` or `/expose`, including extension and query aliases such as
`/profile.html` and `/profile?keep=1`, using `%set-response` with a null entry.
Other routes, including `/profile-other`, are preserved. It also replaces bindings
targeting either retired agent, then disconnects them on the same wire after the
Eyre `%bound` acknowledgement (disconnect requires ownership of the binding).
It sends `%contacts` an explicit null `%expose-cites`
self-contact patch. Other contact fields are preserved.

The migration completes when contacts acknowledges the patch. A nack retries
after 30 seconds; a reload before completion queues cleanup again. All cleanup
operations are idempotent. Once complete, later loads do not repeat cleanup.
This runs on hosted and self-hosted ships without an operator script or retained
teardown agent.
