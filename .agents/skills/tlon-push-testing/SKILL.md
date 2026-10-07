---
name: tlon-push-testing
description: Generate and inject mock Tlon Messenger notifications for local iOS Simulator testing, covering message, thread, workspace, notebook, contact, dismissal, and invalid-payload scenarios. Use for push reception, foreground presentation, notification taps, and destination navigation tests.
---

# Tlon push testing

Create a payload for the requested scenario and verify what the app does when
it receives it and when the user taps it. Read [the scenario catalog](references/scenarios.md)
for the required inputs and expected destination. The catalog covers the current
app handlers, including native envelopes and locally scheduled notifications;
not every case is fully exercisable with simulator injection.

## Gather the target first

Use values the user has explicitly supplied in this task. Ask for missing inputs
together; do not silently choose a booted simulator, app variant, or conversation.

- **Simulator:** exact iOS Simulator UDID and the intended model/runtime. List
  `xcrun simctl list devices available --json` to help the user choose if needed.
- **App variant:** production/development (`io.tlon.groups`) or preview
  (`io.tlon.groups.preview`), or an explicitly supplied custom bundle ID. Confirm
  the installed bundle; icon color or branch name is not sufficient. Some demo
  and E2E builds use the production bundle even when other settings look like preview.
- **Scenario and identifiers:** conversation/channel ID when applicable; also
  workspace, parent post, note, contact, or native notification IDs as listed in
  the catalog. Ask for real IDs instead of substituting example data. A nickname
  alone is not a conversation ID. If lookup is requested, use read-only inspection
  and read `docs/tlon-apps/db-react-query.md` before querying the local database.
- **App state:** foreground (same or different conversation), background, cold
  start, drawer open/closed, or another state required by the reported issue.

These choices persist for the requested run. Do not ask again before every push.
Do not infer permission to send real messages, create invitations, change workspace
membership, register device tokens, or alter the user's drafts. Mocks do not create
the underlying content; use existing test data or separately authorized setup.

## Generate, then inject

Run from the repository root using its pinned Node version. The helper has no
dependencies. Replace the example variables with the user's actual inputs:

```bash
node .agents/skills/tlon-push-testing/scripts/send-push.mjs --list

# Preview only. No device access; optionally save a reusable .apns file.
node .agents/skills/tlon-push-testing/scripts/send-push.mjs \
  --scenario dm-post --channel-id "$CONVERSATION_ID" \
  --bundle-id "$APP_BUNDLE_ID" \
  --title 'Push test' --body 'Open this conversation' \
  --out /tmp/tlon-push.apns

# Inject exactly one notification into the selected installed app.
node .agents/skills/tlon-push-testing/scripts/send-push.mjs \
  --payload-file /tmp/tlon-push.apns \
  --simulator "$SIMULATOR_UDID" --bundle-id "$APP_BUNDLE_ID" --send
```

`--dry-run` is explicit syntax for the default preview mode. `--send` requires an
explicit UDID and bundle, verifies a booted simulator and installed app, and uses
`xcrun simctl push <UDID> <bundle> -`. It neither boots nor launches anything.
The compact UTF-8 payload must fit simctl's 4096-byte limit. Unknown CLI flags,
missing required IDs, repeated options, irrelevant scenario inputs, and conflicting
embedded bundle IDs are rejected. A supplied `--bundle-id` is saved in the payload
as `Simulator Target Bundle`, preventing accidental reuse with another variant.

To prepare a batch, generate separate files for the chosen catalog rows with the
same supplied identifiers. Do not send the entire catalog just because it exists.
Use `--payload-file` for a supplied full payload or an additional edge case; inspect
it first, including its target and native actions. Scenario-building flags cannot be combined with `--payload-file`; edit or regenerate
the file to change its destination.

Use the repository's `tlon-workflow` skill for app boot/build or video capture,
and `stim`/`agent-device` with the explicitly selected device. Local `simctl`
cannot reach an EAS-hosted simulator, an Android emulator, or a physical phone.
For those targets, keep the payload catalog but select an actually supported
delivery mechanism; do not claim local injection reached them. Under a sandbox,
run device commands with the needed host access rather than editing permissions.

## Validate reception separately from navigation

1. Verify notification permission and banner settings for the selected app. A
   successful CLI response proves injection was accepted, not that a banner appeared.
2. Establish the requested app state. Background the app without closing its drawer
   when reproducing TLON-6768. For a cold-start test, terminate only the selected app.
3. Inject once and observe banner/Notification Center, sound, grouping and badge as
   relevant. Foreground notifications for the currently viewed conversation are
   intentionally suppressed; foreground sound is disabled by the app handler.
4. Tap the actual system notification. Opening the app icon or a deep link is a
   different test. A banner is short-lived: inject and tap in one command sequence,
   or open Notification Center and select the exact notification. With agent-device,
   bind to SpringBoard for the banner, then rebind to the app after the tap. Wait for
   navigation to settle before recording the final state; the first frame may still
   show the drawer. Never infer a successful tap from injection alone.
5. Check the destination and drawer independently. For a conversation push the
   destination should be visible with the drawer closed. If it still appears open,
   distinguish an open navigation state from native views stuck at an open transform.
   Check `stim logs --errors` using a short time window and preserve relevant evidence.

Exercise the needed variations from [the reception matrix](references/scenarios.md#reception-matrix).
Keep claims scoped to what was tested. Plain mock alerts bypass the backend's
notification preferences and APNs/FCM transport, and do not prove native rich-preview
rendering, contact-discovery scheduling, or server-side event creation worked.

## Maintain coverage

The catalog points to the app's parser, tap handler, native handlers and schedulers.
When one changes, update the corresponding mocks and destinations. Run:

```bash
node --test .agents/skills/tlon-push-testing/scripts/send-push.test.mjs
pnpm --filter tlon-mobile test-ui --runInBand pushTestingSkill
```

Report the selected simulator/bundle, scenarios, app states, observed results, and
any layer not exercised. Keep private IDs, payloads, screenshots and drafts out of
Git unless they are intentional synthetic fixtures.
