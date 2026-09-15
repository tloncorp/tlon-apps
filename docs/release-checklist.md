# Release checklist

Reconstructed from what the workflows actually do. Where a step names a
workflow, that workflow's trigger is the authority for when it runs.

| stage        | what happens                                                        | workflow                        |
| ------------ | ------------------------------------------------------------------- | ------------------------------- |
| feature      | PRs merge into `develop`; the app suite runs on each                | `ci.yml` (`pull_request`)       |
| version bump | `desk.docket-0`'s `version+[X Y Z]` is rewritten and pushed         | `bump.yml` (the only writer)    |
| glob         | the web bundle is built and globbed, docket updated                 | `build-and-glob.yml`            |
| staging      | `develop` merges to `staging`; pushing it back-merges to `develop`  | `sync-dev.yml`                  |
| release tag  | a `vX.Y.Z` tag is created **by hand** — no workflow creates one     | —                               |
| livenet      | the tag is deployed to `~sogryp-dister-dozzod-dozzod`               | `deploy-livenet.yml`            |
| master sync  | on a completed livenet deploy, `staging` merges into `master`       | `sync.yml` (`workflow_run`)     |
| mobile       | EAS builds are cut separately                                       | `mobile-build.yml`              |

`vX.Y.Z` tags are **desk** version tags: the tag matches `desk.docket-0`'s
`version+[X Y Z]` at that commit. `origin/master`'s tip is the last sync of
`staging` after a deployment workflow ran — `sync.yml` triggers on
`types: [completed]`, whatever the conclusion, and merges the staging tip as it
stands then. Treat it as the standing proxy for the released client, not as a
verified deployed SHA.

## Before tagging

- [ ] `develop` is green, and `staging` carries exactly the commits you intend.
- [ ] `desk.docket-0`'s `version+[X Y Z]` matches the tag, and its glob hash and
      URL point at the bundle built from this commit.

### Desk N-1 compatibility

Policy: `docs/tlon-apps/desk-compatibility.md`. Release N must start, sync,
receive updates, and post against desk release N-1.

- [ ] `MIN_GROUPS_VERSION` equals the **previous** desk release, not the one you
      are cutting.
- [ ] `pnpm check:desk-compat` exits 0 for all three ref pairs — rule (b), then
      self-consistency, then rule (c):

      pnpm check:desk-compat --client-ref <candidate> --desk-ref v<N-1> \
        --base-ref origin/master
      pnpm check:desk-compat --client-ref <candidate> --desk-ref <candidate> \
        --base-ref origin/master
      pnpm check:desk-compat --client-ref origin/master --desk-ref <candidate>

      `--base-ref` is not optional here: without it every `known-gaps.json`
      entry is applied unread, so a candidate carrying both a new unsupported
      request and the entry excusing it exits 0. Runs 1 and 2 pass it exactly
      as `desk-compat.yml` does; run 3 has `origin/master` as its *client*, so
      it would be comparing that ref with itself.

- [ ] Run 1 reports **no** negotiation-protocol difference. A bump blocks the
      pair outright, whatever the paths say, so it must ship a release ahead of
      the client that needs it.
- [ ] Run 2 honours no `protocolBumps` entry at all: within one tree there is
      no transition to be mid-way through, so an exposure raised without its
      local consumers is an inconsistency the candidate's own agents would
      reject each other over, and it blocks.
- [ ] If run 1 reports an `ALLOWED PROTOCOL BUMP`, that bump is shipping in this
      release: N-1 support for the protocol is suspended, which is a deliberate
      break for anyone still on N-1. Confirm the issue it names says so.
- [ ] A stale warning is only evidence from the run that could have seen the
      thing, and the checker now prints one only from that run. Run 2 compares
      the candidate desk with itself, so it can never show a protocol
      difference and never proves a bump obsolete; and only **run 1** measures
      against the release `MIN_GROUPS_VERSION` names, so only run 1 can say a
      `gaps` entry excused nothing — the candidate desk may well have fixed a
      gap N-1 still has. Where a warning does appear, **delete the entry** as
      part of this release: a stale entry is standing permission for a
      mismatch nobody is tracking.
- [ ] Read the `GUARDED` list. Each entry is a request the desk cannot take,
      behind a capability guard nobody verified. For each, check the guard
      resolves false on N-1 and that the branch it falls back to is one N-1
      serves. These never fail the run, so nothing else will catch them.
- [ ] Skim `WILDCARD` and `UNVERIFIED` rather than skipping them: neither
      changes the exit code, and each entry is a call the checker could not
      decide. `MATCHED` is not a promise either — it says an arm pattern
      accepts the pole, not that the agent answers.

### Shipping an `agent:neg` protocol bump

A bump is the change that creates the difference rule (d) forbids, so the bump
PR cannot pass its own gate unless it says so:

- [ ] The bump PR adds a `protocolBumps` entry to
      `packages/scripts/src/check-desk-compat/known-gaps.json` — agent,
      protocol, `from`, `to`, and the issue tracking it.
- [ ] The release *after* the one carrying the bump removes that entry, once the
      bump has become N-1. The checker warns while an entry matches nothing.

## Tagging and deploying

- [ ] Create and push the `vX.Y.Z` tag on the release commit.
- [ ] Dispatch `deploy-livenet.yml` with that tag. It refuses one that does not
      exist.
- [ ] Confirm the deploy succeeded, then that `sync.yml` ran and `origin/master`
      now **contains** the commit you tagged — `sync.yml` does
      `git merge --no-ff staging`, so master gains a merge commit rather than
      becoming the tagged one (`git merge-base --is-ancestor <tag> origin/master`).
      It also fires on a completed run of either polarity, so a failed deploy
      can still move `master`: check the deploy's conclusion, not just that
      master moved.

## After deploying

- [ ] Raise `MIN_GROUPS_VERSION` to the release you just shipped, **only once it
      has shipped**, and re-pin the `~bus` E2E pier
      (`apps/tlon-web/e2e/shipManifest.json`) in the same change.
- [ ] Cut mobile builds from the release tag if it includes native changes.
