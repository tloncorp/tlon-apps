# Concise comments and code suggestions

## Summary versus evidence

Write one short English summary that answers: what is the route, why, and what
must happen next? Aim for 150–250 words. The publisher renders `summary` plus
`comment.impact`, `comment.validation`, and `comment.nextSteps`, alongside rating
and ledger counts. Do not repeat the same conclusion in each field.

- `summary`: the remaining defect or decision and its observable consequence.
- `comment.impact`: one sentence naming affected behavior, shared consumers,
  and material platform or authority boundaries; no file inventory.
- `comment.validation`: strongest observed evidence and material limits. Group
  related gaps. Distinguish executed checks from author claims.
- `comment.nextSteps`: up to four short actions, grouping related work. Include
  every unresolved material requirement, evidence gap, or blocker, even when no
  bot finding exists. Omit cosmetic follow-ups.

All human questions remain visible. Counts summarize the counter-review and
requirements; a refuted claim needs its explanation in the full report, not
another paragraph on the PR. Do not silently drop a blocker to meet the word
target. Keep semantic agreement between the short message and the ledger.

Keep the detailed ledger intact. Hosted publication writes it to the workflow
job summary and links the run from the PR comment. Local runs save a separate
report and preview; never invent a hosted run link. Local file paths are not
accessible evidence for GitHub readers. Use pinned repository links and actual
CI links in a published message, and identify unavailable reproduction artifacts.

## Optional GitHub suggestions

A suggestion is an unapplied replacement attached to current diff lines, not
an instruction to modify the PR. Leave `suggestions: []` unless a small fix adds
value beyond the existing discussion. Never repeat an equivalent suggestion
already present from another reviewer.

Use at most three suggestions for independently confirmed current-head defects
on an `agent-work-needed` assessment. Each must be a self-contained replacement
in one file, at most 20 original and 20 replacement lines, with no required
companion production edits, guessed APIs, new dependencies, or unresolved human
choice. Inspect callers and the complete replacement against the established
contract. A plausible diagnosis alone does not verify the proposed correction.
Multi-file fixes or uncertain corrections belong in next steps instead.

Each structured suggestion contains:

- `findingUrl` and `claim`: the exact ledger entry supporting the correction,
  with `verdict: confirmed` and `reviewedRevision` equal to the assessed head.
- `path`, `startLine`, `line`: a contiguous RIGHT-side range in one current diff
  hunk. For a single-line replacement, start and end are equal.
- `original`: exact original lines, including indentation, joined with LF and
  no extra trailing newline. Do not invent an anchor for code outside the diff.
- `replacement`: complete literal replacement, without Markdown fences. Empty
  means deletion. Do not include three backticks; use ordinary explanation for
  such edits instead. Replacements must not overlap.
- `reason`: one sentence explaining trigger and user-visible consequence.
- `validation`: what establishes the correction and what remains untested.
  Hosted source inspection must never be described as an executed test.

The publisher checks the original text, range, finding, and revision, then emits
a fenced `suggestion` block. It preserves code exactly and only submits a
`COMMENT` review. It does not apply suggestions or certify their correctness.
The author can review and apply the replacement using GitHub, then run the
required checks. Applying it creates a new head that needs a fresh assessment.

For human decisions, ask the precise question with a short reason and existing
evidence. Do not disguise an unresolved policy decision as an applicable fix.
