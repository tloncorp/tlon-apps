# Onboarding lab

A fast way to try changes to Tlonbot's first-run onboarding and see whether
they help. You edit the onboarding skill or a workspace prompt, run a set of
simulated people through onboarding, and get a report that grades each
conversation and the first result it produced. Two sets of runs can be judged
side by side.

By default it runs without Urbit, Docker or the gateway: a run takes under a
minute and a few cents per persona, and personas run in parallel. `--real`
runs the same personas against the actual bot in a local sandbox.

## How a run works

1. A **persona card** (`personas/*.yaml`) describes a person: who they are, what
   they want from the bot, what they know but only share when asked, how they
   write, and how many questions they tolerate.
2. The coordinator's real welcome message opens the chat.
3. A **simulated person** (a second model, playing the card) replies. It taps a
   picker option or types, the way that person would.
4. The **bot** answers with the configured model, the real onboarding skill and
   tlonbot's workspace prompts, and the plugin's own tools and guards. See
   "What is real" below.
5. When the bot posts a task plan, the lab posts the coordinator's real
   acknowledgement, runs the scheduled task once with web search to produce the
   first note, and posts the "first entry is ready" message.
6. **After the ending**, the person sends one unrelated message (`afterEnding`)
   to see whether the bot answers it or keeps steering toward setup.
7. The simulated person says whether they got what they came for.
8. A **judge** model grades the run against the persona card, using
   [`rubric.md`](rubric.md) and the skill the bot was running.

## Fast mode and real mode

**Fast mode** (the default) drives the bot model directly: a few cents and
under a minute per persona, many in parallel. **Real mode** (`--real`) runs
the same personas against the actual OpenClaw bot in a local sandbox: minutes
per persona, one at a time, but nothing is imitated on the bot's side.

### Fast mode is calibrated from real runs

Fast mode doesn't imitate OpenClaw by hand. Every real set captures the exact
requests OpenClaw sends the model, and `lab/templates/openclaw-<version>.json`
keeps one as a template with placeholders where a variant differs: the
workspace files, the plugin skills' descriptions and versions, and per-run
values like the session id. Fast runs fill it in, so their system prompt, tool
list and schemas, request settings, message wrapping and scheduled-run prompt
are OpenClaw's own, byte for byte. The template holds no tlonbot prompt text,
so it is committed.

Still simulated in fast mode:

- Tools run as stand-ins: `tlon` answers `settings get`, `groups list` and
  `contacts self`; `cron`, `write`, `edit` and `message` act on in-memory
  state; the rest record the call and return an error. Web fetch and search
  are real.
- The coordinator's timing and the app. Messages arrive instantly and in
  order, and plans are provisioned without Urbit.

Real mode catches what those miss. Each real set refreshes the template when
OpenClaw's side changed, and every run records how far the tested build is
from the deployed one (OpenClaw version, plugin branch, tlonbot prompts); the
web tool shows the same as a banner.

### Real mode

Real mode needs Docker and a tlonbot checkout (the same `TLONBOT_DIR`). It
starts a separate copy of tlonbot's onboarding sandbox, compose project
`onboarding-lab` on ports 48080–48082 and 48789, so the `dev` stack stays
untouched. On first use it:

- installs this branch's `%groups` desk on the fake ships (the stock pier desk
  is older than the app and plugin code expect), and
- sets what the sandbox leaves at its own defaults the way hosted tlonbot
  does: the tool deny list and reasoning level (read from
  `entrypoint/tlawn.py`), web search off when there's no key, the first-week
  campaign off unless tips are simulated, and model traffic routed through a
  local recording proxy.

Each run resets the ships, the bot's session, settings, cron jobs and
workspace, then plays the app's part as the owner (`src/real/owner.ts`): it
creates the onboarding group and notebook, sends the intro request, taps
picker options, and submits the plan card the way the app does. Every blob it
sends is checked with the app's own parser. Plugin and desk changes must be
committed, because the sandbox loads the plugin from git.

### Measuring the gap

```bash
pnpm lab run --real --personas a,b,c --repeat 2 --no-judge --label x-real
pnpm lab run --personas a,b,c --repeat 2 --no-judge --label x-fast
pnpm lab diverge x-fast x-real   # inputs side by side, behavior, transcripts
pnpm lab swap x-real             # resend real decision points with the old
                                 # fast prompt or tools swapped in
pnpm lab calibrate x-real        # refresh the template from an existing set
```

When fast and real disagree, trust real and fix the lab. `diverge` also
compares each gap with how much two runs of the same persona differ within a
mode, so noise isn't mistaken for a difference.

### Double-texting

`--double-texts` lets the simulated person send a quick second message, about
one move in four, before the bot answers. In both modes the second message
reaches the plugin while the bot's first model call is running, so the
plugin's turn guards block any card the bot tries to post in that turn, and
the message then gets a turn of its own. Fast mode ends such a turn the way
the real bot does: with the plugin's "I didn't reply" warning, or, when the
bot keeps retrying, OpenClaw's timeout errors.

## Setup

The lab reads tlonbot's prompts and keys from a tlonbot checkout. Put its path
in `lab/.env` (gitignored):

```
TLONBOT_DIR=/path/to/tlonbot
```

It picks up `OPENROUTER_API_KEY` and `BRAVE_API_KEY` from that checkout's
`tests/.env`, or from `lab/.env` or your shell. Without a Brave key, web search
returns an error to the bot.

The bot and the simulated person default to the bot model in tlonbot's
`tests/.env`, which keeps a run to a cent or two. Override them with
`LAB_BOT_MODEL` and `LAB_USER_MODEL`, or with the flags below.

Judging is the expensive part, so there are two ways to do it:

- **A Claude session judges** (the cheap default for iteration). Run with
  `--no-judge`, then `pnpm lab packets <setA> <setB>` writes one packet per
  pair of runs plus `INSTRUCTIONS.md`. Ask Claude Code to judge the packets:
  it writes a verdict JSON next to each one. `pnpm lab import <judging-dir>`
  folds the verdicts into both run sets and writes a comparison report.
- **A judge model** (`LAB_JUDGE_MODEL`, default Claude Opus 5.5) grades each run
  as it finishes, and `pnpm lab compare` judges pairs. This costs roughly ten
  times more per round. Keep the judge on a different model family from the
  bot.

## Commands

Run these from `packages/openclaw`.

```bash
pnpm lab personas                         # list persona cards
pnpm lab run                              # every persona once, graded
pnpm lab run --personas founder-blunt,one-off-toast --repeat 3
pnpm lab run --no-judge --variant ~/lab-variants/shorter-questions --repeat 3
pnpm lab packets baseline shorter-questions   # then have Claude judge them
pnpm lab import lab/runs/judging-<stamp>-baseline-vs-shorter-questions
pnpm lab ab --variant ~/lab-variants/shorter-questions   # judge-model version
pnpm lab report baseline                  # re-render a run set's report
```

`run` options: `--personas`, `--repeat`, `--variant`, `--label`,
`--concurrency` (default 4), `--max-turns` (default 8), `--bot-model`,
`--user-model`, `--judge-model`, `--no-judge`, `--no-search`, `--tips`,
`--real`.

Each run set is saved under `lab/runs/<timestamp>-<label>/` (gitignored), with
one JSON file per run, a `manifest.json` and a `report.html`. The manifest
records the git revision, the models, and a hash of the skill and every prompt
file, so you can always tell what produced a result.

## Web tool

```bash
pnpm lab serve            # then open http://localhost:4410
```

A local page for the same workflow:

- **Run sets**: every set with its variant, run count, judged count, headline
  scores and cost, and a link to its report. Tick two to four sets (the first
  is the control) to write judging packets.
- **Comparisons**: each judging folder with its verdict progress and reports.
  "Copy judging prompt" copies a ready-made request to paste into Claude Code;
  "Import verdicts" folds finished verdicts into the reports.
- **Start a run**: pick a variant, personas (all, blank-slate, or by hand),
  repeats, web search, and whether to judge with a model now or in Claude
  later. The estimate shows roughly what it will cost.
- **Jobs**: runs, packets and imports started from the page, with live logs,
  a stop button, and a link to the report when a run finishes.
- **All variants**: every variant, newest change first, with what it changes
  versus its parent in plain words, the files it touches (lines added and
  removed), how many run sets used it, and a flag when it has been edited since
  its last run. Luna writes each description from the diff, caches it in
  `.description.json`, and redoes it only when the variant or its parent
  changes.
- **Variants tab**: pick a variant, edit any file it can override (the skill,
  `coordinator.yaml`, `tips.yaml`, the product guide, tlonbot prompts), and
  compare it with its parent, with production, or, for workspace prompts,
  with OpenClaw's stock template. "New variant" copies one and records its
  parent. "Try it" runs one persona against the variant for about a cent.
- **Tips tab**: edit a variant's tip copy and see every tip in every situation
  as production would render it, updating as you type. Changed tips are
  highlighted. "Personalize" makes the real personalization call for one tip
  with the sample context above it (a fraction of a cent).

It listens on localhost only and runs nothing but the lab CLI. Jobs are child
processes of the server, so stopping the server stops them.

## Trying a change

A **variant** is a folder of edited copies. A `SKILL.md` at its top replaces
the onboarding skill, `tlon-product-guide/SKILL.md` replaces the product guide,
`coordinator.yaml` replaces the welcome and post-setup messages, `tips.yaml`
replaces any first-week tip copy (keys as in production's `TIP_COPY`), and any
other `.md` file replaces the tlonbot prompt with the same name. A `.parent`
file records which variant it started from, for comparisons. The onboarding sandbox's `.sandbox-prompts` folder works as a variant.

```bash
mkdir -p ~/lab-variants/shorter-questions
cp skills/tlon-agent-onboarding/SKILL.md ~/lab-variants/shorter-questions/
# edit it, then:
pnpm lab ab --variant ~/lab-variants/shorter-questions --repeat 3
```

Run the variant and a baseline with the same personas and simulator, then judge
them as pairs (`packets` and `import`, or `ab` with a judge model). A baseline
only needs re-running when the code, models or personas change. The order within each pair is shuffled so
the judge's position bias cancels out. Models are noisy, so use at least three
repeats before trusting a difference. Side-by-side wins are more reliable than
the difference between two average scores.

## Reading the report

- **Ending matched**: the judge's call on whether the conversation ended the
  way this person wanted. A plan counts against the bot for someone who wanted
  a single answer.
- **Conversation** and **first result**: 1–5 scores. Every issue quotes the text
  it is about.
- **Product answers**: 1–5, checked against the product guide, when the person
  asked about the app itself. Empty when they didn't.
- **Follow-up**: whether the bot answered the unrelated message normally.
- **Rule breaks**: clear breaks of the skill's own rules, with quotes.
- **Came for it**: the simulated person's own answer.
- **Pickers** and **user messages**: measured facts, not grades.

## Personas

A persona card is a YAML file in `personas/`:

```yaml
id: one-off-toast
who: Sibling of the bride. Wedding is this Saturday.
wants: Help writing one short toast now. Declines any recurring setup.
expectPlan: no          # yes | no | either
opening: can u help me write a toast for my sisters wedding saturday?
knows:
  - Sister is Maya, marrying Jordan.
style: Warm, a little nervous.
patience: 2             # questions tolerated before getting impatient
asks:                   # optional questions about the app itself, asked when natural
  - Can people join if they don't have the app yet?
afterEnding: thanks. whats a good gift under $100 for them
timezone: America/New_York
```

Keep about half the suite awkward: people who decline, want a single answer,
want a cadence the product doesn't offer, ignore the buttons, or ask for
private data the bot can't reach. The cooperative cases mostly pass already.
# Frozen run inputs and first-week tips

`pnpm lab run --label week-one --tips 3 --no-judge` opts into first-week campaign simulation. `--tips` accepts an integer from 0 through 5 and defaults to 0. The local web form has the same control. The limit caps delivered messages; production eligibility, quiet hours, skipped slots, replies, opt-out, and the five-total-send cap still apply. A persona may receive fewer than the requested number of tips.

Each new labeled run set stores `checkpoint/index.json`. It freezes workspace prompts including `SOUL.md` and `BOOTSTRAP.md`, installed skill files and allowlisted text resources, coordinator overrides, persona cards, rubric, simulator and campaign prompt policies, non-secret substitutions, model choices, search mode, turn limit, judge choice, and tip limit. Resume, grading, and judging packets read the checkpoint. API keys and `.env` files are not serialized. Older run sets remain readable and retain their live-source resume behavior; reports label them as legacy.

The campaign trace records meaningful sends, skips, replies, opt-out, and task-result events, plus final state. The first scheduled result still runs immediately and the optional day-two result remains judge-only. Later recurring task results are not simulated as evidence for campaign messages.
