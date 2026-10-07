# Feature map

How to do each thing in Tlon Messenger, written for Tlonbot to answer from.
One file per area of the app, one entry per task.

This directory is the source. It describes the app at one store build, the one
named in `release.json`, and is brought up to date once per build, not on every
change to `develop`. Bots do not read it. They read the copy in
`packages/openclaw/skills/tlon-product-guide/references/`, which `publish`
writes from it. Never edit that copy by hand.

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
  `publish` leaves it out while the flag is off by default in the store build. An
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

It reads the app's source at the store build named in `release.json`, and
fails when:

- a quoted label is not in the entry's cited files, or a cited file is gone;
- an `absent` term appears in the app's source;
- a screen, message action, feature flag or slash command is in the code but
  no entry covers it and `surface-ignore.txt` does not skip it;
- an entry or the ignore file names one that is not in the code;
- an entry talks about a flagged feature without carrying its flag.

The inventory comes from `packages/app/navigation/types.ts` (screens),
`packages/api/src/types/ChannelActions.ts` (message actions),
`packages/app/lib/featureFlags.ts` (flags) and
`packages/openclaw/src/commands-registry.ts` (slash commands). Print it with
`feature-map.mjs surface`.

CI runs the check when the map, the script or the guide changes. It does not
run on app changes: `develop` moves ahead of the map between store builds, and
that is expected. `--ref <git-ref>` checks against another point, such as the
next build's tag.

What the check cannot see is behaviour that changes while the labels stay the
same: a new permission rule, a button that now opens a different screen. The
read at each store build is for that.

## Updating for a new store build

Do this once per store build, as one PR. It is a job for a coding agent, with
a person reviewing the result. `<new>` is the build's tag, such as
`ios-production-801`. When the newest iOS and Android builds are different
commits, use the older one.

1. See what the build broke:

   ```bash
   node scripts/feature-map.mjs check --ref <new>
   ```

   Fix each problem by reading the source at that tag
   (`git show <new>:<file>`): update a renamed label, write an entry for a new
   screen, delete the entry for something removed.

2. List the entries whose code changed since the build in `release.json`:

   ```bash
   node scripts/feature-map.mjs affected --until <new>
   ```

   It prints the entries, then the changed files they cite with the size of
   each change, then new files no entry cites. Many entries cite the same few
   files, so work through the files: read the diff of each between the two
   builds, then the entries that cite it. Fix an entry when the diff changes
   who can do the thing, where it is found, or what happens afterwards.
   Otherwise leave its wording alone. Look at each new file for something a
   person could ask how to do, such as a new button on an existing screen, and
   write an entry if there is one.

3. Look in `drafts/`. It holds entries, and lines for `surface-ignore.txt`,
   that were written ahead of a build. Nothing reads that folder. Move across
   the ones this build now has and check them like any other.

4. Record the build and write the copy bots read:

   ```bash
   node scripts/feature-map.mjs publish --app <new>
   ```

   It refuses while `check --ref <new>` still reports problems.

5. Before the PR is opened, have a second agent read the changed entries
   against the source at `<new>`. A first pass gets things wrong.

Between builds, fix a wrong entry by hand whenever one is found, then run
`publish` with no `--app`.

Bots run the newest bot code, not the store build, so a new slash command can
reach them a build before its entry does.

## The copy bots read

`publish` writes `packages/openclaw/skills/tlon-product-guide/references/`
from the map: the same text without the anchors, without the entries whose flag
is off in the store build, and it rewrites the index in `SKILL.md`. CI fails
when that copy differs from what `publish` writes.

`release.json` names the store build the map describes: its tag, and the
commit the tag pointed at. Only `publish --app` changes it.

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
