# Feature map

How to do each thing in Tlon Messenger, written for Tlonbot to answer from.
One file per area of the app, one entry per task.

This directory is the source. It follows the code on `develop`, and CI checks
it against that code. Bots do not read it. They read the copy in
`packages/openclaw/skills/tlon-product-guide/references/`, which `promote` writes at each store
release. Never edit that copy by hand.

## Entry format

```markdown
# Workspaces list

Finding, filtering, pinning and tidying the list on the Workspaces tab.

## Pin or unpin a chat
<!-- src: packages/app/ui/components/ChatOptionsSheet.tsx -->

Phone: on the Workspaces tab, press and hold the chat, then tap `Pin`.
Desktop: hover the chat in the sidebar, open its three-dot menu, pick `Pin`.
Notes: pinned chats move to a `Pinned` section at the top.
```

- The `# ` title and the first line under it become the file's line in the
  skill's index, so the first line says what questions the file answers. That
  line is published as written, whatever the release, so keep it to the area
  and do not name a feature that is behind a flag or newer than the store
  build. The index lists each published entry by its heading anyway.
- Each `## ` heading is one task, phrased the way a person would ask about it.
  Headings are also listed in the index, so the bot picks a file by them.
- `<!-- src: … -->` lists the files the entry was written from, as paths from
  the repo root. Every entry needs one.
- Text in backticks is a claim that those exact characters are on screen. The
  check looks for each one in the entry's cited files. Use backticks only for
  literal on-screen text and for slash commands.
- Describe icons by shape ("the three-dot icon"). Put text the app builds at
  runtime in plain quotes, not backticks.

Lines an entry can have, in this order. Leave out any that do not apply:

- `Phone:` the steps in the mobile app.
- `Desktop:` only when it differs from the phone.
- `Who:` only when not everyone can do it: admins, the group's host, hosted
  accounts, the bot's owner.
- `Notes:` what the person sees afterwards, limits, and things people expect
  that the app does not do.

Keep an entry under about 120 words. No file paths, component names or code
terms in the text. Follow the wording rules at the top of
`packages/openclaw/skills/tlon-product-guide/SKILL.md`: "Tlon Messenger", "node", and the phone's
tab names (Bot, Workspaces, Activity, Settings).

## Other anchors

- `<!-- covers: route:ChatVolume, action:pinPost -->` claims items from the
  surface inventory (below).
- `<!-- flag: scheduledTasks -->` marks an entry for a feature behind a flag.
  `promote` leaves it out until the flag defaults to on in the release. An
  entry without the anchor must not talk about the feature, or that sentence
  is published anyway: `flag-words.txt` lists the words that give each
  flagged feature away, and the check fails on one outside a marked entry.
  Put what the feature changes about other things (it can't be left, it isn't
  a place to forward to) in its own marked entries. A quoted label is allowed,
  so the entry for a settings screen can still list the switch.
- `<!-- absent: disappearing messages, read receipt -->` is for entries that say
  the app does not have something. The check fails if any term shows up in the
  app's source, which is the cue to rewrite the entry.

## The checks

```bash
node scripts/feature-map.mjs check
```

It fails when:

- a quoted label is not in the entry's cited files, or a cited file is gone;
- an `absent` term appears in the app's source;
- a screen, message action, feature flag or slash command is in the code but
  no entry covers it and `surface-ignore.txt` does not skip it;
- an entry or the ignore file names one that is no longer in the code.

The inventory comes from `packages/app/navigation/types.ts` (screens),
`packages/api/src/types/ChannelActions.ts` (message actions),
`packages/app/lib/featureFlags.ts` (flags) and
`packages/openclaw/src/commands-registry.ts` (slash commands). Print it with
`feature-map.mjs surface`.

So when a UI change breaks the check, fix the entry in the same PR: update the
label, add an entry for the new screen, or delete the entry for what was
removed.

## What the check cannot see

Behaviour that changes while the labels stay the same: a new permission rule,
a button that now opens a different screen, a setting that moved. Nothing
fails, and the entry is wrong.

The entries at risk are the ones that cite a file you changed. This lists them:

```bash
node scripts/feature-map.mjs affected --since origin/develop
```

It prints the entries, then the changed files they cite with the size of each
change. Many entries cite the same few files, so work through the files: read
each one's diff, then the entries that cite it. An entry needs fixing when the
diff changes who can do the thing, where it is found, or what happens
afterwards, and the text does not say so. The list ends with new files no
entry cites, which is where a new button or menu item with no new screen
shows up.

The check's CI job prints this list in its summary for every PR. It is not a
gate: nothing fails because of it.

## Releasing to bots

```bash
node scripts/feature-map.mjs promote --app ios-production-789
```

`promote` checks every entry against the code at that tag and writes what is
true for it to `packages/openclaw/skills/tlon-product-guide/references/`, with
the anchors removed:

- An entry that passes is published as written.
- An entry that does not pass (its labels arrived after the release, or its
  flag is off there) keeps its previously published wording, as long as that
  wording still passes for this release. Otherwise it is left out.
- An entry that was published before and is no longer in the map stays
  published only when develop has lost what it describes and the release still
  has it. So when a feature is removed on develop, delete its entry as the
  check asks: people on the store build keep the instructions until a release
  drops the feature.
- If develop still has what a removed entry describes, the entry was renamed,
  merged into another, or deleted as wrong, and its old copy goes with it.

`--drop file.md#heading-slug` leaves an entry out regardless. It is for a kept
or held-over copy that turns out to be wrong; once dropped, those stay out. An
entry still in the map is published again by the next promote, so fix or
delete it there instead. A `--drop` that names no entry fails.

`promote` writes nothing if the release tag is not in the checkout or
`SKILL.md` has lost its index markers.

Beside the reference files, `promote` writes `RELEASE.json` (the tag, what was
held back, what was kept after leaving the map), and it rewrites the index in
`SKILL.md`. In this folder it writes `release-anchors.json`: the files and
labels each published entry rested on, which is how an old copy can be tested
against a release. That file is generated too; don't edit it.

### Re-reading at a release

A release is the last point to catch an entry that went wrong without tripping
the check, so the release PR lists the published entries whose code changed
since the previous release. The same list, by hand:

```bash
node scripts/feature-map.mjs affected --published \
  --since ios-production-781 --until ios-production-789
```

`--published` looks at the copy bots read instead of the map. An entry marked
"text changed too" or "new entry" is one this checkout is about to publish
differently from the last commit, so it shows in the PR's diff. The unmarked
ones are the point: their code changed and their text did not.

Reading them is a job for a coding agent, since a busy release can list half
the map. Give it the list and these steps:

1. For each file under "Changed files they cite", read
   `git diff <previous> <release> -- <file>`.
2. Read the entries that cite it. Their `src` lines are in this folder.
3. Report each entry the diff makes untrue, with the line of the diff that
   does it. Leave wording alone.

Fix what it finds in the map on develop, then run the promote workflow again.
Until someone does this read, the release PR's list is only a list.

## Testing answers

`docs/feature-map/questions/` holds the questions the onboarding lab asks the
bot, to see whether a given model finds and repeats what the map says:

```yaml
- id: pin-chat
  ask: how do i keep a chat at the top of my list?
  kind: how-to # or where, who-can, cannot, desktop, concept
  file: workspaces-list.md
  entry: Pin or unpin a chat
  must:
    - press and hold the chat on the Workspaces tab
    - tap Pin
  must_not:
    - says to swipe right
```

Write `ask` the way a person would type it, without the app's own words for
the thing. `must` and `must_not` come from the entry and nothing else. `check`
fails if `file` and `entry` do not name an entry in the map, so renaming a
heading means updating its questions. Leave `file` and `entry` off a `concept`
question that the guide's own text answers.

`core.yaml` is for everyday use: run it, read what failed, fix the map or the
key. `sealed.yaml` is the check on that work. It is run once, with the map,
the keys and the grader frozen, and only its total is reported. Nobody adjusts
anything from which of its questions failed. Once someone has read those
failures, the set is spent: move its questions into `core.yaml` and write a new
sealed set from entries no question uses yet.

Add a question when you add an entry people are likely to ask about, and
whenever a real conversation shows the bot getting something wrong.

In the onboarding lab (`~/Projects/onboarding-lab`), with this checkout's guide
and questions:

```bash
npm run lab -- ask --dry-run \
  --variant <this repo>/packages/openclaw/skills \
  --questions <this repo>/docs/feature-map/questions
```

Its README covers models, guide layouts, grading and cost.
