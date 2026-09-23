# Release checklist

Reconstructed from what the workflows actually do. Where a step names a
workflow, that workflow's trigger is the authority for when it runs.

| stage        | what happens                                                        | workflow                        |
| ------------ | ------------------------------------------------------------------- | ------------------------------- |
| feature      | PRs merge into `develop`; the app suite runs on each                | `ci.yml` (`pull_request`)       |
| version bump | `desk.docket-0`'s `version+[X Y Z]` is rewritten and pushed         | `bump.yml` (the only writer)    |
| glob         | the web bundle is built and globbed, docket updated                 | `build-and-glob.yml`            |
| staging      | `develop` is merged to `staging` **by hand** — no workflow does it  | —                               |
| back-merge   | pushing `staging` merges it back into `develop`                     | `sync-dev.yml`                  |
| release tag  | a `vX.Y.Z` tag is created **by hand** — no workflow creates one     | —                               |
| livenet      | the tag is deployed to `~sogryp-dister-dozzod-dozzod`               | `deploy-livenet.yml`            |
| master sync  | on a completed livenet deploy, `staging` merges into `master`       | `sync.yml` (`workflow_run`)     |
| mobile       | EAS builds are cut separately                                       | `mobile-build.yml`              |

`vX.Y.Z` tags are **desk** version tags: the tag matches `desk.docket-0`'s
`version+[X Y Z]` at that commit. The latest such tag *whose livenet deploy
succeeded* is the released desk and web client — the tag is cut before the
deploy is dispatched, so one that has not been deployed, or whose deploy
failed, is not yet a release. Don't read `origin/master`'s tip as that either:
the same branch also carries the plugin release, which sometimes leapfrogs the
desk.

## Before tagging

- [ ] `develop` is green, and `staging` carries exactly the commits you intend.
- [ ] `desk.docket-0`'s `version+[X Y Z]` matches the tag, and its glob hash and
      URL point at the bundle built from this commit.

### Desk N-1 compatibility

Policy: `docs/tlon-apps/desk-compatibility.md`. Release N must start, sync,
receive updates, and post against desk release N-1.

- [ ] `MIN_GROUPS_VERSION` equals the **previous** desk release, not the one you
      are cutting.
- [ ] If this release removes a desk endpoint older mobile builds still call,
      do it in this order:

      1. Build and publish the mobile apps under a new application version
         (`mobile-build.yml`, production profile — the "After deploying" item
         below, but run ahead of the deploy this time) and confirm they are
         installable from the stores. Dispatch it from `staging` (or cut the
         release tag first and dispatch from it) — the workflow has no ref
         input, so it checks out whatever ref it's dispatched from, and a
         dispatch left on the default builds `develop`.
      2. Raise the mobile minimums in the invite service past the last build
         that made the request.
      3. Only then deploy the release that removes the endpoint, and no sooner
         than one `useRequiredUpdate` polling interval (10 minutes) after the
         minimum was raised: an app that is already running keeps its cached
         minimum until its next poll.

      Raising the minimum first replaces every installed app with the
      required-update screen — `useRequiredUpdate` acts when it sees a minimum
      above the installed version, on launch or at its next 10-minute poll — and
      leaves it there until the store publishes the replacement. The new
      application version is what lets the minimum bite at all: `useRequiredUpdate`
      compares the marketing version (`nativeApplicationVersion`), not the
      build number, so a minimum cannot separate two builds that share one.
      The ordering is best-effort, not a guarantee: `useRequiredUpdate` fails
      open, so an app that cannot reach the invite service keeps running against
      the removed endpoint until it can.

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
      The workflow's conclusion is not proof on its own either: `deploy.sh`'s
      remote `rsync` and `+hood/commit` run without `set -e` and its `curl`
      calls omit `--fail`, so a failed commit still exits green. Confirm the
      live ship's `%groups` desk reports the tagged version before treating the
      tag as released.

## After deploying

- [ ] Raise `MIN_GROUPS_VERSION` to the release you just shipped, **only once it
      has shipped**, and re-pin the `~bus` E2E pier
      (`apps/tlon-web/e2e/shipManifest.json`) in the same change.
- [ ] Cut mobile builds from the release tag if it includes native changes.
      Dispatch `mobile-build.yml` with `profile=production` and the platforms
      you intend. `profile` offers `preview` and `production`, `platform`
      offers `all`, `android`, and `ios`, and neither declares a default — the
      dispatch form preselects the first choice, and the workflow itself falls
      back to `preview` and `all` for an empty input. So a dispatch left alone
      builds preview apps, and this box can be ticked with no production build
      made.
