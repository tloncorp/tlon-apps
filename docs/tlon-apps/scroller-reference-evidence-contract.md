# Real reference loading and revision evidence

These two desktop Chromium cases extend CNT-11, STA-02/03 and FLK-07/12.
Criteria are saved before implementing or executing the cases. They use the
actual ChatMessage, Reference and usePostReference paths with normal application
flags and Vite development assets. Mobile web and presented-frame proof remain
excluded. They do not qualify voice memo, A2UI, failed references or all content.

The source is a committed local-ship post older than the initial 50-post sync
window. A fresh browser context opens a different channel. The test requires
an actual `/v5/said/~zod/<source channel>/post/<source id>` subscription from
the application: this independently proves the reference needed its network
fallback. A cached reference with no such request is an incomplete preparation.
The test holds that one actual request briefly, then forwards it unchanged;
it never supplies fabricated reference data or changes application DOM state.

The containing post has a reference followed by an unchanged, declared paragraph.
The reference's author and exact source text are separate from the unchanged
paragraph and its selected interior character. One case follows latest; the
other reads the reference with newer messages below and more than 100 CSS px
remaining to latest. Neither preparation may be inferred only from row count.

| Phase | Independent witness | Required user-visible result |
| --- | --- | --- |
| Pending | Exact source/channel subscription is held; actual `Loading remote content...` UI is present for at least 200 ms | Correct outer post and unchanged paragraph remain mounted, exposed and unobstructed. No ready or error content is substituted for the declared pending state |
| Resolve | The actual held request is forwarded; production subscription and DB insertion finish | Correct source author and exact first revision appear. Pending/error text disappears; no empty or wrong-reference interval is accepted after readiness |
| Edit | An actual channel post edit commits a longer second revision on the source ship while the reference remains mounted | Cached first revision may remain while the write propagates. The second revision must become visible by the 10-second action deadline, then must never revert. No loading-skeleton reset or unrelated text is allowed |
| Quiet tail | Terminal readiness is independently marked after each revision | At least 1,000 ms of complete samples after each terminal marker. Correct reference text and unchanged paragraph persist; source and outer post identities remain scoped |

Throughout each measured load/edit interval, the unchanged character must stay
within 1 CSS px of its baseline relative to the actual list viewport, including
when the quote changes the height inside the same outer row. FOLLOW additionally
keeps the exact bottom within 1 CSS px. History is judged by the character rather
than requiring the outer row origin to remain fixed. Legitimate clipping of the
quote is permitted; the declared reading character must stay exposed.

Capture actual text inventory, CSS/ancestor visibility, clipping and interior hit
tests, paired list/row geometry, reference pending/ready/error text, source IDs,
original and edited backend essays, and request/release/commit timestamps with
their clock domains. Missing phase, stale or duplicate identity, unavailable
text/hit witnesses, sampling gaps over 100 ms or acquisition over 32 ms are
incomplete evidence; observed content or geometry violations remain failures.
No producer PASS flag can override raw evidence. Navigation, source replacement,
permission errors and reference-remount behavior require separate future cases.
