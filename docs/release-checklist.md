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
      has shipped**, and rebuild the pinned N-1 E2E pier in the same change —
      the `N-1 Desk E2E` job fails fast when the two disagree. `~bud` is the
      N-1 pier; `~bus` is a different ship, kept deliberately far out of date
      for protocol-mismatch rendering, and is not re-pinned here.
      1. Set `~bud`'s `deskVersion` in `apps/tlon-web/e2e/shipManifest.json` to
         the new `MIN_GROUPS_VERSION`, and bump its `downloadUrl` to the next
         `rube-bud<n>.tgz`.
      2. `cd apps/tlon-web/rube && ./build-n1-pier.sh` — boots a fresh `~bud`,
         commits the `v<deskVersion>` desk to it, and leaves the archive in
         `rube/dist/`.
      3. Upload it: `gsutil cp rube/dist/rube-bud<n>.tgz gs://bootstrap.urbit.org/`
         then `gsutil acl ch -u AllUsers:R gs://bootstrap.urbit.org/rube-bud<n>.tgz`.
      4. Dispatch `n1-e2e.yml` to confirm the new pier works before the next
         staging push depends on it.
- [ ] Cut mobile builds from the release tag if it includes native changes.
