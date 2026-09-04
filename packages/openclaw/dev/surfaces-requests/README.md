# Revision request records

One JSON file per revision request the verdict run intends to issue. Each is
both the **prompt text** (`request`) and the **assertion** that the app does not
already do the thing (`witness`).

They are one file on purpose. In 6a.5 the requests were composed in a prompt and
the apps' current behaviour was assumed rather than checked, and four of five
requests turned out to be already satisfied — so the run measured "does the loop
no-op correctly" while believing it was measuring "does the loop edit or
regenerate". Keeping the sentence and its precondition in the same record means
`dev/surfaces-run.sh --request <id>` can read the sentence out of the record it
just asserted against, and the two cannot drift.

## Running one

```
TLON_URL=http://localhost:35453 TLON_SHIP='~zod' TLON_CODE=<code> \
  bun dev/surfaces-assert-unsatisfied.ts --request <id>
```

Exit 0 means ABSENT — issue it. Exit 1 means PRESENT or ABSTAIN — **replace the
request**, do not argue with it. Exit 2 means the preflight could not run.

Evidence lands in `dev/surfaces-6a-out/assert-unsatisfied/<id>/`:
`assertion.json` (authoritative), `assertion.txt` (readable), the spec, the
verified bundle, the live state, and the twelve rendered PNGs the painted text
was read from.

## Writing a witness

The witness is a pattern set that has to be **shown to discriminate** before it
is used. See `dev/surfaces-witness.mjs`'s header for the full argument; the
mechanics are:

- `renderPatterns` are searched against the painted text and control labels of
  all twelve cells, against the recipe, and against the bundle source. They are
  prose patterns, because all four of those surfaces are prose or UI copy.
- `actionPatterns` are searched against each action's `id` plus its serialised
  ops. They are separate and separately required, because a prose pattern
  applied to an action map matches nothing ever, and "no action provides it"
  would then be true by construction — which is 6a.5's failure wearing a
  preflight's clothes.
- Each list needs a `positive` example (or the set can be vacuous) **and** at
  least one `negative` example drawn **verbatim from the target's own current
  output** (or the set can be universal). A set that misses its positive, or
  matches any negative, is refused as ABSTAIN before anything is read off the
  ship.

To draw negatives from reality rather than from imagination, dump what a channel
actually paints:

```
bun dev/surfaces-render-probe.ts --bundle <b.js> --spec <spec.json> \
  --state <live.json> --out /tmp/look
```

Painted text arrives whitespace-collapsed with **no separator between adjacent
text nodes** — a stat reading `1` above a label reading `responses` arrives as
`1responses`. Write patterns that tolerate that, and paste negatives verbatim
rather than tidying them.

**When in doubt, broaden.** The error budget is asymmetric: a witness that is too
broad refuses a request that was fine and costs one candidate; a witness that is
too narrow passes a request the app already satisfies, which is 6a.5 exactly and
costs the whole measurement. The negative examples are what stop broadening from
running all the way to a preflight that refuses everything.

## Fields

| field                                     | meaning                                                            |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `id`                                      | file basename; names the evidence directory                        |
| `channel`                                 | nest, e.g. `chat/~zod/dash-abc12345`                               |
| `request`                                 | the exact sentence sent to the bot — read from here, never retyped |
| `behaviour`                               | what "satisfied" would mean, so a human can judge the patterns     |
| `shape`                                   | `render-only` \| `action-map` \| `structural`                      |
| `witness.*Patterns`                       | JS regex sources, matched case-insensitively                       |
| `witness.*Positive` / `*PositiveSource`   | the example and where it came from                                 |
| `witness.*Negatives` / `*NegativesSource` | near-misses, and where they came from                              |

The `*Source` fields are free text and are copied verbatim into the evidence.
They are how a later reader tells an example drawn from a real render apart from
one somebody made up — which is the difference between a calibrated pattern and
a plausible-looking one.

## The controls

`control-*.json` are not part of the verdict run's sample. They are the
demonstration that the preflight discriminates in both directions, kept as files
so it can be re-run:

- `control-nonresponders-rsvp` — 6a.5's already-satisfied "show who hasn't
  responded yet" against its old target. Must REFUSE.
- `control-nonresponders-poll` — **byte-identical witness**, different channel.
  Must PASS. The pair holds the pattern set constant, so the flip is a property
  of the two apps and not of pattern-tuning.
- `control-running-total-chess`, `control-running-total-climbing` — 6a.5's other
  already-satisfied request against both of its candidate targets. Must REFUSE.
