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

      pnpm check:desk-compat --client-ref <candidate> --desk-ref v<N-1>
      pnpm check:desk-compat --client-ref <candidate> --desk-ref <candidate>
      pnpm check:desk-compat --client-ref origin/master --desk-ref <candidate>

- [ ] Run 1 reports **no** negotiation-protocol difference. A bump blocks the
      pair outright, whatever the paths say, so it must ship a release ahead of
      the client that needs it.
- [ ] Read the `UNVERIFIED` list rather than skipping it: it never changes the
      exit code, and each entry is a call the checker could not decide.

## Tagging and deploying

- [ ] Create and push the `vX.Y.Z` tag on the release commit.
- [ ] Dispatch `deploy-livenet.yml` with that tag. It refuses one that does not
      exist.
- [ ] Confirm the deploy succeeded, then that `sync.yml` ran and
      `origin/master` advanced to the commit you tagged. `sync.yml` fires on a
      completed run of either polarity, so a failed deploy can still move
      `master`: check the deploy's conclusion, not just that master moved.

## After deploying

- [ ] Raise `MIN_GROUPS_VERSION` to the release you just shipped, **only once it
      has shipped**, and re-pin the `~bus` E2E pier
      (`apps/tlon-web/e2e/shipManifest.json`) in the same change.
- [ ] Cut mobile builds from the release tag if it includes native changes.
