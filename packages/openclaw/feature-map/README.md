# Feature map

How to do each thing in Tlon Messenger, written for Tlonbot to answer from.
One file per area of the app, one entry per task.

This directory is the source. It follows the code on `develop`, and CI checks
it against that code. Bots do not read it. They read the copy in
`skills/tlon-product-guide/references/`, which `promote` writes at each store
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
  skill's index, so the first line says what questions the file answers.
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
`skills/tlon-product-guide/SKILL.md`: "Tlon Messenger", "node", and the phone's
tab names (Bot, Workspaces, Activity, Settings).

## Other anchors

- `<!-- covers: route:ChatVolume, action:pinPost -->` claims items from the
  surface inventory (below).
- `<!-- flag: scheduledTasks -->` marks an entry for a feature behind a flag.
  `promote` leaves it out until the flag defaults to on in the release.
- `<!-- absent: disappearing messages, read receipt -->` is for entries that say
  the app does not have something. The check fails if any term shows up in the
  app's source, which is the cue to rewrite the entry.

## The checks

```bash
node packages/openclaw/scripts/feature-map.mjs check
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

What the check cannot see: behaviour that changes while the labels stay the
same, such as a new permission rule. If you change who can do something or what
happens after a tap, read the entries that cite the files you touched.

## Releasing to bots

```bash
node packages/openclaw/scripts/feature-map.mjs promote --app ios-production-789
```

`promote` checks every entry against the code at that tag. Entries that pass
are written to `skills/tlon-product-guide/references/` with their anchors
removed. An entry that does not pass (its labels arrived after the release, or
its flag is off there) keeps its previously published wording, or is left out
if it was never published. `references/RELEASE.json` records the tag and what
was held back, and the index in `SKILL.md` is rewritten to match.

## Testing answers

`packages/openclaw/feature-map/questions/` holds the question set the
onboarding lab runs against bot models. Add a question when you add an entry
people are likely to ask about, and when a real conversation shows the bot
getting something wrong.
