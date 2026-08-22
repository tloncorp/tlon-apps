---
id: TASK-29
title: >-
  Decide whether %notes ships: it is absent from desk.bill but kits installs
  depend on it
status: To Do
assignee: []
created_date: '2026-08-20 19:13'
updated_date: '2026-08-22 20:06'
labels:
  - workspaces
  - backend
  - kits
dependencies: []
priority: high
type: bug
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`desk/app/notes.hoon` exists and has tests, but `%notes` is not listed in `desk/desk.bill`, so Gall never starts it. Meanwhile TASK-27 made `%notes` a valid kit place kind and `+place-card` in `desk/app/kits.hoon` pokes `[our.bowl %notes]` to create a notes-backed place, and TASK-13's meal-plan kit declares its artifact place as `notes`.

So on a stock ship, installing the hero kit cannot create its artifact place: the poke goes to an agent that is not running. That makes the starter artifact — the whole point of the activation moment — impossible, and it is invisible in tests because the Hoon agent tests drive `%kits` directly rather than through a booted ship.

Confirmed on the local walkthrough rig: `%kits` and `%apps` are both in desk.bill, `%notes` is not, and `grep notes desk/desk.bill` returns nothing. Started it by hand on the two fakezods with `+hood/rein %groups [& %notes]` over the loopback lens, which is fine for a demo and obviously not a fix.

The decision this carries is not mechanical. Adding a line to desk.bill starts `%notes` for every user on upgrade, which is a call about whether that agent is ready to ship — its state model, its migration story, its surface. The alternative is that kits must not declare `notes` places until it is, which would mean reverting the hero kit's artifact place to something already running.

I raised the desk.bill absence as a standing flag in earlier sessions without fixing it; it is now load-bearing rather than cosmetic.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decision is recorded: either %notes joins desk.bill, or kit manifests may not declare notes places until it does
- [ ] #2 If %notes ships: it is in desk.bill and a kit install creates its notes place on a freshly booted ship with no manual rein
- [ ] #3 If %notes does not ship yet: the meal-plan kit's artifact place points at an agent that actually runs, and placeKindSchema rejects notes so a manifest cannot declare an unrunnable place
- [ ] #4 A test catches the general case — a kit declaring a place whose host agent is not in desk.bill fails rather than installing into nothing
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation plan (researched 2026-08-22)

**The task's premise is stale: the decision was already made and shipped.** `391021b86c` (2026-08-20, "kits: derive a cron turn's group from its session nest; ship %notes in the bill") added `%notes` — and `%apps` — to desk.bill after this task was filed. %notes is not a stub: 3,102 lines, versioned state (state-15 with a supported 14→15 migration), spec doc in docs/notes. Live evidence for AC #2 already exists in volume: every provisioning run on the dev rig since (all of yesterday's and today's workspaces, on ships whose %groups agents were nuked + revived, i.e. restarted strictly from desk.bill) created its notes-backed plans place with no manual rein — install ledgers show `notes/~ten/plans-*` places and the agent wrote real notes into them.

So the remaining work is only **AC #4** — the regression test that catches the general case.

### Steps

1. **Record the decision (AC #1):** %notes ships; it is in desk.bill as of 391021b86c. Check ACs #1 and #2 on the evidence above. AC #3 becomes N/A (its trigger — "%notes does not ship" — is false); `placeKindSchema` keeps `notes`.
2. **AC #4 test** in `desk/tests/app/kits.hoon`:
   - Import the shipped bill: `/*  bill  %bill  /desk/bill` (the %bill mark is vendored via peru — `pkg/base-dev/mar/bill.hoon` is in the pick list, present in desk-deps/mar).
   - New arm `++  test-place-hosts-are-in-the-bill` (plain tang-returning arm, no mare needed): assert that every dude `+place-card` can target is present in the bill — today `%channels` (chat/notebook/gallery places) and `%notes` (notes places). The kind→dude pairs live in the test with a comment pointing at `+place-card`; the pairing is the assertion, so a future place kind whose host agent is missing from desk.bill turns -test red instead of installing into nothing.
3. **Run on-ship** via the screen-dojo recipe (`-test /=groups=/tests/app/kits/hoon`, expect ok=%.y 25/25), deploy the tests file to both ships, commit.

Estimated diff: ~20 lines in one test file. No agent or manifest changes.
<!-- SECTION:PLAN:END -->
