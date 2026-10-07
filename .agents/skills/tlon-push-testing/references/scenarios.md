# Notification scenario catalog

Commands run from the repository root. `send-push.mjs --list` lists all named mocks;
each `--scenario` prints ready-to-save APNs JSON. Add `--out /tmp/name.apns` to save
it; sending is a separate, explicit `--send` operation with a simulator and bundle.

## Payload layers

**Routing mocks (default):** `aps.alert` supplies the visible test text and
`activityEventJsonString` is a JSON **string** containing `{ "event": { ... } }`.
Custom data is at the top level of the APNs JSON, not nested in a `data` field.
The generator includes only the event fields consumed by the tap parser, not a
complete server activity record. Do not feed these partial events to the native
rich-preview renderer. It deliberately omits `mutable-content` and a fabricated
UID so an extension cannot replace the test payload with a failed network fetch.

The top-level `channelId` and `aps.thread-id` are set for conversation and notebook
mocks. `channelId` alone does not route a notification. It also participates in
notification cleanup: the app may dismiss notifications whose channel is fully
read, and notifications without a channel ID. Never add an unrelated channel ID
to a workspace or contact mock just to defeat cleanup.

**Native envelopes:** `native-notify`, `native-message`, and `dismiss` model the
native protocol. Building/injecting an envelope does not demonstrate that iOS
ran its extension or background callback. Verify native logs; otherwise report
that layer as untested. A real `native-notify` uses a user-supplied UID retrievable
by the signed-in app; the extension fetches the event and renders it. The generic
message needs no conversation, while dismiss is silent and has no tap destination.
When adapting `native-notify` to Android delivery, also supply
`--notification-id`: its native receiver requires both `uid` and `id`.

**Local-notification equivalents:** contact-match and node-resume mocks imitate
the data delivered to the JS handler. `simctl push` still delivers them as remote
notifications. Use the real scheduler when testing local scheduling, replacement,
permission prompts, discovery or cancellation.

## Identifier formats

| Input | Meaning |
| --- | --- |
| `--channel-id '~ship'` | Single DM's other participant, not the current user |
| `--channel-id '0v…'` | Existing group-DM/club ID; every `dm-*` scenario supports both types |
| `--channel-id 'chat/~host/channel'` | Full channel nest; other existing kinds such as `heap` are accepted |
| `--group-id '~host/workspace'` | Workspace/group flag, not a channel nest |
| `--parent-id '~author/170.141.…'` | Wire ID of the thread's root post; author plus decimal `@da`, not Unix milliseconds |
| `--post-id '~author/170.141.…'` | Wire ID of the post being flagged; optional message key for telemetry on other message mocks |
| `--channel-id 'notes/~host/notebook'` and `--note-id '123.456'` | Notebook plus existing decimal note ID; parser removes dot grouping |
| `--contact-id '~ship'` | Contact whose profile should open |
| `--ship '~ship'` | Kicked member or node owner, depending on scenario |

The examples above describe formats, not IDs to inject. Ask for the real values.
Mocks do not populate the database. Missing conversations may trigger the app's
normal targeted recovery; if still unavailable, the handler clears the target.
Thread roots and notes should exist if the test is meant to show actual content.

## Conversation mocks

Every row needs `--channel-id`. The script's mention aliases set `mention: true`
on the underlying `post`, `reply`, `dm-post`, or `dm-reply` event; a literal
`post-mention` event discriminator would be wrong.

| Scenario | Additional required inputs | Destination / variation |
| --- | --- | --- |
| `dm-post` | None | Single DM or group DM |
| `dm-post-mention` | None | Same route, mention variation |
| `dm-reply` | `--parent-id` | Root post's thread within the DM/group DM |
| `dm-reply-mention` | `--parent-id` | Same thread, mention variation |
| `dm-react` | None | DM/group DM containing the reacted-to top-level message |
| `dm-react-reply` | `--parent-id` | Root thread of the reacted-to reply |
| `dm-invite` | None | DM/group DM after invite-target recovery/sync; requires existing server-side invite/data for a real invite test |
| `post` | None | Channel; test existing chat/gallery/bulletin channel kinds as applicable |
| `post-mention` | None | Same channel, mention variation |
| `reply` | `--parent-id` | Parent thread in channel |
| `reply-mention` | `--parent-id` | Same thread, mention variation |
| `react` | None | Channel containing reacted-to top-level post |
| `react-reply` | `--parent-id` | Root thread of reacted-to reply |
| `flag-post` | `--post-id` | Flagged post opened as a thread |
| `flag-reply` | `--parent-id` | Flagged reply's parent thread |
| `note-create` | `--note-id` | Selected note in notebook (`notes/...`) |
| `note-edit` | `--note-id` | Same note destination for an edit |

Optional `--group-id` on channel mocks preserves workspace context in the event.
Optional `--post-id` supplies a message key. Without a real message key, DM tap
attribution telemetry is intentionally not covered. These routing fixtures do not
test rendered media, sender avatars, reaction emoji, unread counts, or notification
volume rules; use a real fetched activity record for those layers.

## Workspace and contact mocks

| Scenario | Required inputs | Current tap behavior |
| --- | --- | --- |
| `group-ask` | `--group-id` | Workspace members / join requests |
| `group-invite` | `--group-id` | Chat list with the group's invite preview; actual invite state controls the preview |
| `group-join` | `--group-id` | Workspace members |
| `group-role` | `--group-id` | Workspace members |
| `group-kick` | `--group-id`, `--ship` | Other member: members screen. Current signed-in user: chat list. Test both branches; the mock does not actually kick anyone. |
| `contact` | `--contact-id` | Profile from a backend activity event |
| `contact-matched` | `--contact-id` | Profile from `type: contactMatched` (local-discovery equivalent) |
| `contacts-matched` | None | Contacts screen from `type: contactsMatched` |
| `node-resume-nudge` | `--ship` | App opens; no special route in the current JS parser. Real scheduler uses a fixed ID and a ten-minute delay; this mock tests neither. |

Do not assume all notification destinations close the drawer: the current
conversation handler explicitly closes it; profile, workspace and contact routes
use different navigation paths. Record actual behavior against the requested UX.

## Generic, native, and negative mocks

| Scenario | Required inputs | What to observe |
| --- | --- | --- |
| `message` | None | Generic visible message; `action: message`, no conversation navigation |
| `native-message` | None | Generic native message envelope with `mutable-content: 1`; verify extension invocation separately |
| `native-notify` | `--uid` | Native fetch/rich-preview envelope; use a real retrievable UID. Supply an intentionally unavailable UID only for an explicit fetch-failure test. |
| `dismiss` | `--uid`, `--notification-id`, `--dismiss-source`, `--notify-count` | Silent `content-available: 1`; remove matching older/equal notification IDs and update badge if UID is current enough |
| `malformed-activity` | None | Invalid serialized activity JSON; no JS navigation or crash |
| `unknown-activity` | None | Unknown activity discriminator; no JS navigation or crash |
| `missing-event` | None | Valid JSON without its `event`; no JS navigation or crash |
| `unrecognized` | None | Plain alert without routing data; no JS navigation or crash |

Common options: `--title`, `--body`, `--badge` (nonnegative integer), `--thread-id`,
`--notification-id` (top-level `id`), `--uid`, and `--extension-error` (adds a mock
`notificationServiceExtensionErrors` entry). `node-resume-nudge` defaults to the real
scheduler wording. Dismiss builds a silent envelope and rejects alert/badge options;
its badge count comes from `--notify-count`. It is not a visible message.

For a dismissal test, first deliver alerts with explicit `--notification-id` and
`--thread-id`; then use that grouping string as `--dismiss-source` and the intended
cutoff as `--notification-id`. iOS compares IDs and UIDs as strings. Use consistent
ordering, including older/equal/newer cases. Observe callback execution and delivered
notifications; background execution is subject to iOS scheduling. A badge-only or
custom native envelope can be supplied with `--payload-file`.

## Reception matrix

Choose the rows relevant to the task; a successful DM background tap does not cover
them all. Do not mutate production state just to obtain a test case.

| State / variation | Expected observation or limitation |
| --- | --- |
| Foreground, same conversation or its thread | Banner/list/badge suppressed by the app's active-channel policy |
| Foreground, different conversation | Visible notification; app handler disables sound |
| Background, drawer closed / open | Notification tap opens its conversation; drawer closes |
| Already on the target DM / another conversation | Both paths should land at the requested target |
| Terminated app, tap notification | App starts and routes after session/navigation are ready; don't prelaunch it to perform this test |
| Notification permission denied, Focus, scheduled delivery | Injection may succeed with no immediate banner; inspect settings and Notification Center |
| Desk compatibility unresolved/incompatible; onboarding lock | Target is deferred until the existing navigation gates allow it |
| Missing/deleted channel, offline, pending invite | Recovery may fail; no crash or invented destination; mock does not create content |
| Duplicate taps, two destinations, notification grouping | Verify the latest intended tap, response clearing, and each destination independently |
| Read/unread changes while app resumes | Presented notifications can be removed by cleanup; don't misdiagnose removal as failed injection |
| Native fetch failure / extension timeout / render error | Requires native-path evidence; `--extension-error` tests JS error forwarding only |
| Badge, older dismiss, equal/newer dismiss | Verify both delivered-notification cleanup and UID ordering, separately from navigation |
| Recently dismissed keyboard + large unopened channel | Additional drawer/native-animation regression case; independent of a missing close action |

## Source of truth

Paths are relative to the repository root:

- `apps/tlon-mobile/src/lib/notificationPayload.ts`: accepted payloads and routing data.
- `apps/tlon-mobile/src/hooks/useNotificationListener.ts`: destinations, deferred taps and recovery.
- `apps/tlon-mobile/src/lib/notificationPresentation.ts` and `packages/app/lib/notifications.ts`: foreground policy, cleanup, contacts and node-resume scheduling.
- `packages/api/src/urbit/activity.ts`: activity union and mention variants.
- `packages/scripts/src/index.ts`: full native notification preview input/output.
- `apps/tlon-mobile/ios/Notifications/NotificationService.swift`, `ios/Shared/Notifications/PushNotificationManager.swift`, and `ios/Landscape/NotificationDismissHandler.swift` (the last two under `apps/tlon-mobile/`): native receive, fetch, fallback and dismiss.
- `apps/tlon-mobile/android/app/src/main/java/io/tlon/landscape/TalkMessagingService.kt` and `notifications/NotificationManager.kt` beside it: Android native path; FCM and native intent behavior are not validated by iOS injection.
- `apps/tlon-mobile/src/lib/dmTapTelemetry.ts`: iOS trigger payload versus Android `content.data`.

When adding an event, compare all of these layers rather than assuming every
native notification is routable or every routable payload creates a native preview.
