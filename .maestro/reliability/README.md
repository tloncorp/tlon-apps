# Native reliability tests

Twelve single-ship journeys for chat, message actions, search, history, links,
groups, channels, notebook, gallery, profile, settings, and relaunch persistence.
These cover a subset of the QA checklist, not the entire workbook.

Use Maestro 2.6.1 and an installed build containing this branch's app changes.
Load credentials from your secret store into the environment; do not put them in
tracked files or command arguments:

- `MAESTRO_APP_ID`: the installed app's bundle/application ID.
- `MAESTRO_TEST_SHIP`: the expected isolated test ship, including `~`.
- `MAESTRO_RUN_TAG`: a unique tag containing only letters, numbers, and hyphens.
- `MAESTRO_EMAIL` and `MAESTRO_PASSWORD`: the hosted test account credentials.
  Alternatively, use `MAESTRO_LOGIN_URL` and `MAESTRO_LOGIN_CODE` for self-hosting.

From the repository root, with an explicit device ID:

```sh
maestro --udid DEVICE_ID test .maestro/reliability
maestro --udid DEVICE_ID test .maestro/reliability/chat.yaml
```

By default every journey clears local app state and logs in. Set
`MAESTRO_SESSION=warm` to retain an existing login; the app still restarts and the
flow verifies the ship identity before modifying data, through Settings, which
is where the user's own profile now lives.

Two things about the current app shape are worth knowing before editing a flow:

- **The app restores where it was closed.** `stopApp`/`launchApp` no longer
  returns to the chat list; it comes back to the screen the flow left, for 24
  hours. The journeys that relaunch (settings, profile, notebook, relaunch)
  assert the restored position rather than re-navigating to it. A fresh session
  is unaffected, because `clearState` takes the saved position with it.
- **iOS tab buttons are invisible to selectors.** The native tab bar exposes
  only its container, so `subflows/workspaces-tab.yaml` and
  `subflows/settings-tab.yaml` tap a point inside it. The percentages are
  chosen to land on the right tab whether or not the account has the Bot tab,
  which adds a fourth button and shifts the rest; see the comments in
  `workspaces-tab.yaml`. Prefer those subflows over a hand-written tap, and
  call `subflows/to-tab-root.yaml` first if a screen may be covering the bar.

Do not run concurrent profile/settings journeys against the same account. These
tests create private groups and posts that remain on the ship; only the
lifecycle tests delete their own fixtures. Profile restores the original
nickname in its completion hook; settings restores the original theme on
success.

Multi-ship delivery, DMs, notifications, media, extended onboarding/recovery, and
advanced collaborative notebook cases remain outside this suite.

The GitHub Actions workflow `.github/workflows/mobile-reliability-nightly.yml`
runs this suite on `develop` nightly at 07:00 UTC and supports manual runs. It
uses EAS to build an iOS Simulator app and Android APK, then runs the flows in
Maestro Cloud. Android tests follow iOS even if iOS fails. The final Actions job
reports every build and test result, with links to the Maestro Cloud runs.

The EAS workflow `apps/tlon-mobile/.eas/workflows/e2e-nightly-ios.yml` remains a
manual fallback and no longer owns the schedule.

GitHub Actions supplies the test credentials for `~batbet-litnec` from repository
secrets. Keep one Cloud device per platform for this shared account and avoid
overlapping manual runs: Cloud can parallelize flows within a suite. The suite
list comes from `config.yaml`, so later default journeys run nightly too.
