# Native reliability tests

Twenty default single-ship journeys, including attachments, profile details, pins,
references, privacy, sections and notification preferences.
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

Two extra flows have prerequisites: `contacts.yaml` requires `MAESTRO_CONTACT_SHIP`
to name another test ship absent from Contacts; `files.yaml` requires Android and
network access to the pinned public PDF fixture. It checks attachment persistence
and opening, not PDF contents. These two are excluded from the default suite.

Profile details restore the original status/bio. Profile groups remove their new
pin on completion and delete their fixture group on success. Serialize profile
mutations on a shared ship. Image tests import `fixtures/attachment.png`; media
picker selectors assume the qualified portrait iOS/Android layouts.

The full default suite has not been rerun together. DMs, push notifications, avatar
color, iOS documents, offline send/retry, and gallery custom titles remain gaps.

The new role/privacy/section/notification/thread journeys delete their own groups
on success. Notification checks verify saved preferences; push delivery and
enforcement on another ship require multiparty tests.

`roles.yaml` passes on iOS but still fails a saved-role row assertion on Android.
`thread-controls.yaml` still fails Android reply-count validation and iOS mute
persistence after relaunch. Both run individually and are excluded from the
default suite; their assertions remain intact for investigation.
