# The eval corpus

Thirty-three one-sentence requests, one JSON file per request, `id` = basename.

This is the input side of the eval harness. `dev/surfaces-score.mjs` is the
output side; `dev/surfaces-eval-run.sh` is what drives one request at the bot
and deposits the evidence the scorer reads.

## What is in it

| slice                     | count | notes                                                 |
| ------------------------- | ----- | ----------------------------------------------------- |
| in scope                  | 27    | three per template, all nine templates                |
| deliberately out of scope | 6     | must route AWAY from surfaces                         |
| verbatim from session 6a  | 8     | `origin: "session-6a"`; the sentences are not retyped |

The nine templates each get three: `poll`, `workout-tracker`, `rsvp`,
`potluck`, `habit-tracker`, `leaderboard`, `countdown`, `expense-split`,
`kanban`.

## Why the out-of-scope six are not filler

A corpus of only in-scope requests can only measure under-triggering. It cannot
see the opposite failure at all — a skill that fires on everything scores a
perfect routing column on such a corpus while being unusable in a real group.
Six of the thirty-three exist to make over-triggering visible, and they are
weighted the same as the rest.

They are also not random negatives. Four of them sit deliberately close to an
in-scope record, and `pairedWith` names the neighbour:

- `oos-poll-lookup` / `poll-movie-night` — **the same trigger word, opposite
  correct answers.** 6a measured "poll" routing away from the surfaces skill
  twice on independent samples. The obvious repair is to make the word
  magnetic, and a corpus that only contains `poll-movie-night` would score that
  repair as a clean win. The pair is what stops that: a fix that only adds
  gravity passes one and fails the other, and the two numbers move in opposite
  directions.
- `oos-weather-saturday` / `rsvp-barbecue-headcount` — both are questions.
  Only one of them has an answer that keeps changing as members act.
- `oos-weather-saturday` / `countdown-lease-expiry` — both open with a one-shot
  question. Only one goes on to ask for the answer to be kept.
- `oos-remind-landlord` / `countdown-lease-expiry` — both are about a future
  date. Only one is a thing a group looks at; the other has to fire.

## Fields

| field             | meaning                                                                          |
| ----------------- | -------------------------------------------------------------------------------- |
| `id`              | file basename; names the run directory and the scoreboard row                    |
| `request`         | the exact sentence sent to the bot — **read from here, never retyped**           |
| `origin`          | `session-6a` (verbatim from that run) or `authored-6b`                           |
| `originNote`      | where a `session-6a` sentence came from, so it can be checked against the source |
| `expect.routes`   | must this reach the surfaces skill at all                                        |
| `expect.template` | which template we expect it to adapt — **reported, never gated** (see below)     |
| `expect.awayTo`   | out-of-scope only: where it should go instead                                    |
| `expect.why`      | the argument for the expectation. Required                                       |
| `pairedWith`      | the record this one discriminates against                                        |
| `notes`           | anything a reader of the scoreboard needs in order to read the row               |

### `expect.why` is required on purpose

An expectation with no argument behind it is unfalsifiable: when the run
disagrees, nothing on the record says whether the run was wrong or the
expectation was. Every record carries the reasoning, so a disagreement is a
thing two people can settle by reading rather than by re-running.

### `expect.template` is reported, never gated

Several requests have a defensible second answer — a chore rota is arguably a
leaderboard, a blocked-work board is arguably a list. Scoring template choice
as pass/fail would turn a judgement call into a number and then optimise
against it. The scoreboard prints the expected template beside the observed
one and counts the disagreements; it does not fail a request for choosing
differently. `habit-chore-rotation` carries a note saying so.

### The sentence is read out of the record

Same rule as `dev/surfaces-requests/`, for the same reason: 6a.5's measurement
was invalidated because the sentence that was cleared was not the sentence that
went down the wire. `surfaces-eval-run.sh --request <id>` reads `request` out of
this file and never takes it from a command line.

## What the corpus does NOT say

It carries no rubric verdicts and no expected screenshots. Screenshot scoring is
an **input** the bot-harness run fills in — `preview/rubric.json` in the run
directory — because it is a judgement made by whoever is looking at the twelve
captures, and nothing here can make it in advance.

Three of the defects this corpus is aimed at are invisible to every automated
axis in the scorer, and are recorded in the records that carry them:

- `0.5` for a chess draw against the integers-only rule (`leaderboard-chess`) —
  the gate does not enforce it.
- An expense split published with no member action at all
  (`expense-beach-trip`) — it renders perfectly.
- "you owe" copy in an app whose `render` cannot know who is viewing
  (`expense-airbnb-four-ways`) — it renders perfectly too.

They are the standing argument for why the rubric slot is not optional.
