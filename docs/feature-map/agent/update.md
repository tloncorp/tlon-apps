You are bringing a product guide up to date with a newer build of the Tlon Messenger app.

- OLD is the build the guide describes now: `{{old}}`, commit `{{old_commit}}`.
- NEW is the build it must describe when you finish: `{{new}}`.

The guide is `docs/feature-map/`. A support bot answers "how do I…" questions from it, so a wrong entry sends a real person looking for a button that is not there. Read `docs/feature-map/README.md` first: the entry format, the wording rules, and the section "Updating for a new store build". Then do steps 1 to 3 of that section. Step 4 (`publish`) is run for you afterwards.

## Limits

- Edit files under `docs/feature-map/` only. Never edit `packages/openclaw/skills/tlon-product-guide/references/`; it is generated.
- Do not commit, push, switch branches or open a pull request.
- The files in this checkout are newer than NEW. Never describe something because you see it in a file on disk. Read the app's source only with `git show {{new}}:<path>`, and compare builds only with `git diff {{old_commit}} {{new}} -- <path>`.

## Steps

1. Run `node scripts/feature-map.mjs check --ref {{new}}`. Fix every problem it reports: correct a renamed label, write an entry for a new screen or message action, remove the entry for something NEW no longer has. Find the right text in the source at NEW.

2. Run `node scripts/feature-map.mjs affected --since {{old_commit}} --until {{new}}`.
   - For each file under "Changed files they cite", read its diff between the two builds, then every entry that cites that file (search `docs/feature-map/*.md` for the path). Change an entry only when the diff makes one of its sentences untrue for NEW: who can do the thing, where it is found, the steps, what happens afterwards, what is shown, a number or a limit. When the diff only refactors, restyles or renames code, leave the entry exactly as it is.
   - Entries may say "newer versions of the app…" about something OLD did not have. If NEW has it, rewrite the sentence as plain fact.
   - For each file under "New files no entry cites", read it at NEW. If it adds something a person could ask how to do, such as a new button or menu item on an existing screen, write an entry for it in the file for that area.

3. Look in `docs/feature-map/drafts/`. For each entry there, check whether NEW has what it describes: every file in its `src` line exists at NEW and every label it quotes is in those files. If so, read it against the source at NEW, correct it, and move it into the map file of the same name. Do the same for the lines in `drafts/surface-ignore.txt`. Leave the rest where they are.

4. If you renamed or removed a heading that a question in `docs/feature-map/questions/*.yaml` points at, update that question's `entry:`. Change a question's `must` or `must_not` only when the entry no longer says it.

5. Run `node scripts/feature-map.mjs check --ref {{new}}` again. It must report 0 problems before you stop.

## Writing entries

- Text in backticks is a claim that those exact characters are on screen. Copy it from the source at NEW, and make sure the file it comes from is in the entry's `src` line.
- An entry for a feature behind a flag that is off by default carries `<!-- flag: name -->`, and no other entry talks about that feature.
- Write for someone who has never seen the code: no file paths, component names or code terms in the text.
- Do not improve wording you were not otherwise changing. A small, exact diff is the goal.

## Report

Your final message is read by the person who reviews the pull request. Plain text, no preamble:

- **Changed:** one line per entry, as `file.md › heading: what changed and why`, naming the source file that shows it.
- **Added:** one line per new entry, with the file it came from.
- **Moved in from drafts:** the headings.
- **Removed:** one line per entry, with the reason.
- **Not settled:** anything you could not confirm from the source at NEW.

Say "none" for a list with nothing in it.
