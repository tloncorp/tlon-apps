# The harness's own negative control

Two run directories, scored by `dev/surfaces-score.test.mjs` on every CI run
of `pnpm --filter @tloncorp/openclaw test`. They are the demonstration that
the scoreboard can fail.

A scoreboard is a guard over a whole measurement, so its demonstration has to
be a whole broken RUN — not a broken assertion. And it has to come in a pair,
because "the broken run scored broken" is satisfied by a scorer that scores
everything broken. The clean half is what makes the broken half mean
something. Same argument as `dev/surfaces-requests/`'s
`control-nonresponders-rsvp` / `control-nonresponders-poll` pair, one level up.

## `clean-run/`

Two requests whose evidence is internally consistent:

- `poll-movie-night` — the shipped poll template's real bytes, a real capture
  manifest, a complete rubric sheet stamped with those bytes, and a publish
  document naming the same bytes with a read-back observation. Scores `pass`
  on all nine axes.
- `oos-weather-saturday` — an out-of-scope request whose transcript shows the
  bot reading messages and answering in chat, inside the cap. Scores `pass`
  on routing and budget; every other axis is `n/a`.

## `broken-run/`

Six requests, six independent breakages, **every one of them shaped to look
like a success.** The artifacts are present, the transcripts show the pipeline
running, and `publish.json` reports `outcome: "published"` with a read-back
observation in four of the six. A scoreboard that read the run's self-report
would score this run clean.

| request                 | what is wrong                                                        | what catches it                           |
| ----------------------- | -------------------------------------------------------------------- | ----------------------------------------- |
| `poll-movie-night`      | the bundle invokes `vote-ranch`, an action the spec does not declare | the gate, re-run over the bytes on disk   |
| `potluck-bringing-what` | a complete rubric sheet stamped with a different bundle's hash       | rubric identity, checked against the file |
| `oos-poll-lookup`       | an out-of-scope request that built and published a surface           | routing, plus two contradictions          |
| `rsvp-book-club`        | an in-scope request whose turn never reached the surfaces skill      | routing                                   |
| `habit-physio-daily`    | `publish.json` names bytes that are not the bytes in `artifacts/`    | the `published-other-bytes` cross-check   |
| `kanban-zine-project`   | the turn was killed on the 300s cap, mid-pipeline                    | the `budget` axis and the `cap-killed` outcome |

Scored, it produces **zero** passing requests, three `contradiction` rows, two
`fail` rows, one `cap-killed` row, and exit status 1.

The cap kill is the one that is not a defect in anything. It is a result about
the pipeline — the verdict run measured generation-from-nothing at roughly
twice the cost of a revision, median around 160s against a 300s cap, with one
turn killed outright, while 6a.5 concluded "the budget is not the constraint"
from a sample that was almost entirely revisions. A harness that dropped or
retried cap kills would reproduce that wrong reading at corpus scale, so this
fixture exists to prove one survives scoring with its own outcome instead of
being folded into `fail`.

The six are deliberately caught by six different mechanisms rather than one.
A negative control that trips a single check proves that check works and says
nothing about the others, and the cross-checks are the part of the scorer
with no other coverage — they only fire when two sources disagree, which never
happens in a hand-written unit fixture unless somebody makes it happen.

## The synthetic parts, named

The rubric sheets in both runs carry a top-level `_fixture` key saying so.
Their twelve cell observations and seven verdicts were written by a generator,
not read off a capture. They exist to exercise the validator's complete-sheet
path; nothing in them is evidence about any app, and the `_fixture` key is
there so a later reader cannot mistake them for a scoring record.

The transcripts are likewise synthesised in the shape OpenClaw writes
(`{type: "message", timestamp, message: {role, content: [...]}}`), not captured
from a container. What they exercise is the routing detector's pattern set and
the phase-timing derivation, both of which read a real transcript the same way.
Their timestamps advance line by line on purpose: a fixture where every line
carried the same instant would exercise the phase split against a turn that
took zero seconds, in which every phase is trivially cheap.

The app bundles and the capture manifest are **real**: the poll template's
actual bytes, and a manifest produced by an actual `surface preview` run. The
gate really runs over them, which is why the negative control needs `bun` and
fails loudly rather than skipping when it is missing.

## Regenerating

The fixtures are committed, not generated at test time — a fixture rebuilt by
the code under test is a fixture that agrees with it by construction. If a
schema they encode changes (the rubric artifact's shape, the publish document's
fields, the transcript's part types), update them by hand and re-run
`node --test dev/surfaces-score.test.mjs`; the pair failing in opposite
directions is what says the update was right.
