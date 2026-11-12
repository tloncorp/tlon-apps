# Work inbox

Open **Work** in the sidebar. The default **Needs attention** view shows blocked
work, uncertain results, and document proposals awaiting review. Other filters
show Running, Waiting, Finished, or All records. A source selector narrows the list.

The inbox is read-only. Open a record to review it or take action.

## What the states mean

| Source | Meaning |
| --- | --- |
| Task | Open and claimed tasks are Waiting; assigned does not mean running. Blocked tasks need attention. Done records an outcome, not proof of an external action. |
| Artifact proposal | Pending proposals need review. Accepted and rejected proposals are Finished. Accepting does not publish. |
| Hand input | Running requires active execution. Completed execution waits for delivery. Execution or delivery failure is Blocked; uncertain delivery stays Uncertain even after cancellation. |
| Schedule | Active schedules are Waiting, paused ones Blocked, and ended/cancelled ones Finished. Individual runs appear as hand inputs. |
| Notes operation | Waiting or Uncertain according to its saved result. Check that result before repeating a write. |

“Reply recorded delivered” means the hand recorded delivery. In a Tlon DM,
that may mean local Messenger acceptance rather than remote arrival. Check
the conversation and delivery diagnostics before deciding to retry.

Expand **Recorded evidence** for IDs, versions, and execution or delivery details.
Task and proposal links open the selected record.

Counts are records, not unique jobs: a task, proposal, schedule, and delivery
receipt may describe the same work. There is no dismiss or read marker; source
retention and archive/retirement operations determine what stays visible.

## Scope and freshness

The inbox excludes ordinary browser conversations, peer/subagent turns without
a hand record, and adapter work not yet admitted. Inspect those in their
conversation or Tlon diagnostics. An empty inbox does not mean the ship is idle.

The inbox refreshes on entry, focus, and every 30 seconds while visible.
Overlapping refreshes share one read. Rows use stored metadata and excerpts,
not document or transcript fetches; proposal review checks the actual artifact.

Counts cover the selected source before state filtering and pagination.
Rows sort by descending source timestamp, then source/identity for ties.
Records without timestamps do not get invented ones.

Changed work or filters invalidate pagination. **Refresh from first page** starts
a fresh view. Read failures show an error and mark retained rows as stale.

## API and implementation

Owner ACP method: `harness/inbox`.

```json
{"state":"attention","kind":"all","limit":24,"cursor":null}
```

- `state`: `attention` (default), `all`, `uncertain`, `blocked`, `approval`,
  `running`, `waiting`, or `finished`.
- `kind`: `all` (default), `task`, `proposal`, `input`, `schedule`, or `notes`.
- `limit`: 1–32; defaults to 24.
- `cursor`: the preceding page's opaque continuation, or null.

The response contains `items`, source-scoped `counts`, the next `cursor` or null,
`observedAt`, and `referenceOnly: true`. Row fields refer to their source records.
Models cannot call this owner aggregate through administration; they use their
scoped work tools.

`lib/harness-inbox` scans metadata and retains one page plus a continuation
candidate. Only selected rows become JSON. It uses no persisted inbox index,
session replay, Notes reads, or writes. Read cost grows with retained record count.

## Verification

From the local test ship's Dojo:

```text
-test /=harness=/tests/harness-inbox
-test /=harness=/tests-integration/harness-inbox
```

Native tests cover classification, counts, timestamps, excerpts, and pagination.
The isolated integration fixture checks owner/model access without executing
emitted cards. Browser fixtures cover links, errors, page recovery, and polling.

`tests-js/inbox-conformance.mjs` reads a loopback ship with `SHIP_URL`,
`SHIP_COOKIE`, and `SOAK_EXPECT_SHIP` set. It checks reads and parameter
rejection without changing work; coverage depends on the retained data.

For sustained-operation checks, see [reliability](reliability.md).
