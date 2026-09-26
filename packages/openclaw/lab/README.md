# Onboarding lab

A fast way to try changes to Tlonbot's first-run onboarding and see whether
they help. You edit the onboarding skill or a workspace prompt, run a set of
simulated people through onboarding, and get a report that grades each
conversation and the first result it produced. Two sets of runs can be judged
side by side.

It runs without Urbit, Docker or the gateway. A run takes under a minute and a
few cents per persona, and personas run in parallel.

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

## What is real and what is approximated

Real, imported from the plugin:

- Every skill the plugin installs (`tlon`, `tlon-agent-onboarding`,
  `tlon-product-guide`), listed and readable at the same paths the bot uses,
  plus tlonbot's workspace prompts and the per-turn notes the gateway adds to
  owner messages (`src/onboarding-turn-context.ts`).
- The typed tools' names, descriptions, parameter schemas and validation
  (`tlon_agent_choice`, `tlon_agent_task_plan`, `tlon_agent_service_setup`).
- The turn guards in `src/onboarding-tool-boundary.ts`: one picker per turn, no
  plan after a picker, stale-turn blocking, and `cron` blocked while onboarding
  is incomplete.
- The coordinator's messages and the scheduled-run prompt
  (`agentOnboardingTesting` in `src/monitor/agent-onboarding.ts`).
- Onboarding stays incomplete, and the skill note keeps being added, until a
  first entry is produced. This is the plugin's current behavior.
- Web search (Brave) and page fetches.

Approximated:

- OpenClaw's own system prompt framing. The workspace files, skill listing and
  tool guidance are real, but the wrapper around them is rebuilt in
  `src/context.ts`.
- The `tlon` tool answers only `settings get`, `groups list` and
  `contacts self`. `cron` succeeds without scheduling anything once onboarding
  is complete.
- Delivery and the app itself. Timing races (a user sending "hello?" while a
  plan is provisioning), the app's picker UI, and notebook delivery are not
  simulated. Those belong to the real-stack tier.

When the fast tier and the real stack disagree, trust the real stack and fix
the lab.

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
`--user-model`, `--judge-model`, `--no-judge`.

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
- **Jobs**: runs, packets and imports started from the page, with live logs and
  a stop button.

It listens on localhost only and runs nothing but the lab CLI. Jobs are child
processes of the server, so stopping the server stops them.

## Trying a change

A **variant** is a folder of edited copies. A `SKILL.md` at its top replaces
the onboarding skill, `tlon-product-guide/SKILL.md` replaces the product guide,
and any other `.md` file replaces the tlonbot prompt with the same name. The onboarding sandbox's `.sandbox-prompts` folder works as a variant.

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
