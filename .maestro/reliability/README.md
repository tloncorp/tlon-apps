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
flow verifies the ship identity before modifying data. Do not run concurrent
profile/settings journeys against the same account. These tests create private
groups and posts that remain on the ship; only the lifecycle tests delete their
own fixtures. Profile restores the original nickname in its completion hook;
settings restores the original theme on success.

Multi-ship delivery, DMs, notifications, media, extended onboarding/recovery, and
advanced collaborative notebook cases remain outside this suite.

The separate `Maestro two-ship test` workflow runs on demand. It starts disposable
`~zod` and `~ten` ships on CI using this checkout's backend, exposes only `~zod`
through an IP-restricted tunnel, and reuses a qualified Android Cloud binary.
An API peer creates the group and sends a message; Maestro receives it, replies,
and sees the peer's acknowledgement without reloading. Invite/accept UI is not
covered. Dispatch `.github/workflows/maestro-fakeship-proof.yml` on this branch.

CI needs `MAESTRO_CLOUD_API_KEY` and `MAESTRO_FAKE_SHIP_NGROK_TOKEN`. The workflow
pins the Cloud project, binary, device, and CLI. Prepared ship snapshots are keyed
by backend/manifest inputs; a miss prepares cold ships, while a mismatched warm
snapshot fails quickly. App builds and local native caches are not involved.
The retained artifacts include backend hashes and the peer's delivery receipt.
