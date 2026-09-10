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
maestro test --udid DEVICE_ID .maestro/reliability
maestro test --udid DEVICE_ID .maestro/reliability/chat.yaml
```

By default every journey clears local app state and logs in. Set
`MAESTRO_SESSION=warm` to retain an existing login; the app still restarts and the
flow verifies the ship identity before modifying data. Do not run concurrent
profile/settings journeys against the same account. These tests create private
groups and posts that remain on the ship; only the lifecycle tests delete their
own fixtures. Profile restores the original nickname in its completion hook;
settings restores the original theme on success.

All twelve journeys passed on iOS Simulator and Android Maestro Cloud during the
September 10 qualification, combining suite runs and targeted reruns. Those runs
preceded stacking this suite on PR #6429; the combined keyboard changes still need
a native rerun, including Android API 33. Hosted login
was exercised; self-hosted setup was not part of that qualification. Multi-ship
delivery, DMs, notifications, media, extended onboarding/recovery, and advanced
collaborative notebook cases remain outside this suite.
