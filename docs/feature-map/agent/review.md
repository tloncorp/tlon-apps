A first pass has just updated a product guide, `docs/feature-map/`, to describe a newer build of the Tlon Messenger app. Its edits are in this checkout, uncommitted. You are the second reader. First passes get things wrong, and nobody checks this on a device, so your read is the last one before a person reviews it.

- OLD is the build the guide described before: `{{old}}`, commit `{{old_commit}}`.
- NEW is the build it must describe now: `{{new}}`.

A support bot answers "how do I…" questions from this guide. Read `docs/feature-map/README.md` for the entry format and the wording rules.

## Limits

- Edit files under `docs/feature-map/` only. Never edit `packages/openclaw/skills/tlon-product-guide/references/`; it is generated.
- `publish` already ran after the first pass, so `docs/feature-map/release.json`, the guide's `references/` and its index already name NEW. That is expected; leave them alone. `publish` runs again after you.
- In `docs/feature-map/questions/sealed.yaml`, the only change allowed is an `entry:` that follows a renamed heading. If the first pass changed anything else there, put it back and say so under **Not settled**.
- Do not commit, push, switch branches or open a pull request.
- The files in this checkout are newer than NEW. Read the app's source only with `git show {{new}}:<path>`, and compare builds only with `git diff {{old_commit}} {{new}} -- <path>`.
- The commands you can run are `git show`, `git diff`, `git log`, `git status`, `git ls-tree`, `grep`, and `node scripts/feature-map.mjs` with `check` or `affected`. Anything else is refused. To search the source at NEW, pipe `git show {{new}}:<path>` into `grep`.

## Steps

1. See what the first pass changed: `git status --short docs/feature-map` and `git diff -- docs/feature-map`.

2. For every entry it changed, added or moved in from `drafts/`, check each sentence against the source at NEW, using the files in the entry's `src` line. Look hardest at who can do the thing, where it is found, the exact labels, the order of steps, what happens afterwards, and any number or limit. Fix what is wrong. Wrong means it would send a typical person the wrong way; do not add rare cases or loading states (the README's "Write for the usual path"). If the first pass reworded an entry the code did not require it to, put the old wording back (`git diff` shows it).

3. Check what it left alone. Run `node scripts/feature-map.mjs affected --since {{old_commit}} --until {{new}}`. Every entry under "Entries to re-read" cites code that changed, and the first pass will have left most of them as they were. Go through every file under "Changed files they cite", biggest change first: read its diff between the two builds, then each entry that cites it, and confirm the entry is still true for NEW. Fix any that are not. When a diff changes a button, a row or who can do something, search the whole map for other entries that mention it too; the first pass often fixes one and misses the rest. Do not stop at a sample; an entry nobody re-reads here goes out unchecked.

4. Run `node scripts/feature-map.mjs check --ref {{new}}`. It must report 0 problems before you stop.

## Report

Your final message is read by the person who reviews the pull request. Plain text, no preamble:

- **Fixed:** one line per entry, as `file.md › heading: what was wrong`, naming the source file that shows it.
- **Confirmed:** how many changed entries you read and found correct, and how many of the untouched entries from step 3 you checked, out of how many there were.
- **Not settled:** anything you could not confirm from the source at NEW.

Say "none" for a list with nothing in it.
