---
id: TASK-29
title: >-
  Decide whether %notes ships: it is absent from desk.bill but kits installs
  depend on it
status: To Do
assignee: []
created_date: '2026-08-20 19:13'
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
