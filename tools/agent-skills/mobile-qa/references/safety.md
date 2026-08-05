# Safety on a real account

The device almost always has the user's **real, logged-in account** — real
colleagues, real groups, real DMs (you can tell from the conversation content).
Treat it that way. A blanket "run the QA tasks" authorizes reading and driving the
UI; it is **not** consent to do things that reach real people or destroy shared
state.

## Do freely (inward-facing, reversible)

Navigation, opening sheets/screens, filtering, tab switching, pin/unpin,
mark-as-read, viewing member lists and settings, changing a setting you then
restore. Screenshot as evidence.

## Do NOT do on the real account

- **Send messages** to real people (DMs, group posts, replies).
- **Invite / kick / ban / revoke** against real ships.
- **Leave / delete** a real shared group or channel the user is in.
- **Forward** content into a real conversation with people in it.
- **Join** an arbitrary group by a real code.

For the destructive/admin *tests* that the checklist genuinely needs, route them
through a **throwaway group you create yourself** (create → run kick/ban/leave/
delete/permissions against it → delete it as cleanup). That exercises the same UI
without touching shared state. A bot DM (e.g. `openjames`) or a placeholder ship
(`~sampel-palnet`) is a safe target for "route to a DM" style tests since nothing
is delivered to a real person.

## When a step is unavoidably outward-facing

Surface it and get an explicit yes before doing it. If the user has broadly
authorized destructive actions, still apply judgment: run them against your
throwaway constructs, not the company's primary 80-member group. Confirming a
`Leave`/`Delete` dialog and then **cancelling** is a valid way to verify the
confirm-dialog test without the irreversible step — record it as such.

## Single-device limits — mark, don't guess

- "All members see the change" / cross-ship propagation → verify only the
  initiating side; mark the propagation `needs 2nd ship`.
- Mismatched-agent-version warnings, private-group ask-to-join accept/reject →
  `NOT TESTABLE (single device)`.

## Housekeeping

- If you create a throwaway group, **delete it** at the end (host → Delete group).
- If you set `svc power stayon true`, that's fine to leave; it only affects
  behavior while charging.
- If you toggled a real setting to test it (notification level, privacy), restore
  it unless the object is a throwaway you're about to delete.
