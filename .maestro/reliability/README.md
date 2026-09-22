# Native reliability tests

Thirty default single-ship journeys, including attachments, Gallery links,
profile details, pins, references, privacy, sections, notification preferences,
roles, replies and App Info clipboard verification.
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
- **Android tab labels are content descriptions, and those words also turn up
  in content.** A contact row carries a "Bot" badge, which satisfied the old
  tab-bar guard in `subflows/to-tab-root.yaml`: the unwind was skipped on the
  Contacts screen, the screen stayed over the bar, and the tab selection that
  followed tapped a tab that was not there. The guard now keys on the native
  bar's own view ids -- `navigation_bar_item_icon_view` for the bar,
  `screen-header-back` for a screen above it -- which content cannot imitate.
  Do not put tab labels back into it.
- **Settings runs several screens deep.** On an account with an agent the bot's
  own sections render above the App section, so `subflows/settings-row.yaml`
  allows 25s up and 30s down and centres what it finds. Top to `App info`
  measured 17.7s on a Pixel 7a, against the 10s allowed before; and a row left
  at the bottom edge can hand the tap meant for it to the tab bar behind.

**Known gap — the ten group-fixture journeys fail on an account with an
agent.** `subflows/create-group.yaml` builds its fixture through the create
sheet's "New group" action, and that action is not offered on a phone whose
account has an agent: a Workspace is what the flow is for on mobile now. A
Workspace is also not shaped like the template group these journeys expect --
it arrives titled "My agent group" with a single chat channel called "General",
gains a notes channel called "Updates" only when it is the account's first, and
never gets a Gallery -- so rebuilding the fixture from one means renaming the
group, renaming its channel and creating the missing ones, against a group
furnished over the network by the bot. That is tracked in TLON-6632, which
records the full shape of the problem. Until it lands, chat, channels, gallery, history, links, message-actions,
notebook, relaunch, search and home-groups are expected to fail on
`~batbet-litnec`; settings and profile, which create nothing, still pass.

Do not run concurrent profile/settings journeys against the same account. These
tests create private groups and posts that remain on the ship; only the
lifecycle tests delete their own fixtures. Profile restores the original
nickname in its completion hook; settings restores the original theme on
success.

Three extra flows have prerequisites: `contacts.yaml` requires `MAESTRO_CONTACT_SHIP`
to name another test ship absent from Contacts; `files.yaml` requires Android and
network access to the pinned public PDF fixture; and `self-hosted-recovery.yaml`
requires `MAESTRO_LOGIN_URL` and `MAESTRO_LOGIN_CODE`. They are excluded from the
default suite. The files flow checks attachment persistence and opening, not PDF
contents. `channel-sorting.yaml` is also a focused standalone flow.

The default suite runs profile, profile details, and profile groups serially on
the shared account. Profile details restore the original status/bio. Profile
groups remove their new pin on completion and delete their fixture group on
success. Image tests import `fixtures/attachment.png`; media picker selectors
assume the qualified portrait iOS/Android layouts.

The full default suite has not been rerun together. DMs, push notifications, avatar
color, iOS documents, offline send/retry, and gallery custom titles remain gaps.

The new role/privacy/section/notification/thread journeys delete their own groups
on success. Notification checks verify saved preferences; push delivery and
enforcement on another ship require multiparty tests.

`gallery-link.yaml` validates the three-field Link composer, malformed-URL error,
and rich metadata preview and prefill. It deletes its uniquely named fixture
group.

`join-group-navigation.yaml` opens the Join a group sheet from Home, verifies its
code-entry controls, then closes it and returns to Home without mutating a group.

`channel-sorting.yaml` creates a uniquely named text channel, posts there, then
posts in Chat so recency and arrangement have different observable orders. It
asserts the recency section and channel positions, restores arrangement, and
deletes its fixture group.

`notebook-channel-lifecycle.yaml` creates a public `%notes` Notebook through
channel management, proves it opens the folder/note interface rather than the
legacy Bulletin feed, creates a root folder and nested folders through both the
parent-row and viewed-folder actions, cancels and confirms deletion of both an
empty folder and a populated subtree, and preserves an unrelated sibling note.
It moves a note and a full nested folder subtree to a searched destination while
checking exact actions, success toasts, source absence, destination presence,
and note content. It also exercises cancel and confirm on note and channel
deletion and relaunches before proving the deleted Notebook remains absent. It
deletes its short, run-tagged fixture group on success.

`notebook-folder-contents.yaml` builds a small root/parent/child tree with root,
direct, and descendant notes. It verifies immediate-only folder contents,
folder-before-note and newest-note ordering, descendant-inclusive singular and
plural counts, note creation targeted through both a folder-row action and the
currently viewed nested folder, and narrow stacked navigation into a nested note.
The nested-note check asserts its exact folder path, full updated date, title,
body, and note → folder → Notebook Back path. It deletes its run-tagged fixture
group.

`notebook-preview.yaml` creates one disposable `%notes` Notebook and note. It
asserts the empty preview message, contains malformed Markdown without a crash,
renders every heading/emphasis/list/code/link construct in its deterministic body,
opens the exact example-link host, returns to the live editor, and verifies the
original Markdown source is preserved exactly. It deletes its run-tagged group.

`notebook-title-edges.yaml` creates an untitled note and proves its fallback,
whitespace trimming, and body preservation. It then saves a long title and
asserts that title in the detail view, Notebook row, and action sheet before and
after relaunch. It deletes its run-tagged group.

`self-hosted-recovery.yaml` clears local state, rejects a malformed ship URL,
rejects a well-formed access code that the configured ship does not accept, then
corrects only the code and verifies the exact configured ship after login. Run it
standalone when another flow owns the current native session.

`thread-controls.yaml` remains standalone: iOS loses the muted state after
relaunch. Its mute-persistence assertion remains intact for investigation.

`app-info-copy.yaml` seeds the operating-system clipboard with a unique value,
copies the visible Build version from App Info, then pastes through the platform
search UI and asserts the exact result. This intentionally does not use Maestro's
separate in-memory clipboard as the copy oracle.

`thread-lifecycle.yaml` remains standalone while its immediate reply-count
assertion has a known iOS failure. It checks reply counts through 1 → 2 → 1 → 0: cancel
preserves both replies; deleting one preserves its sibling and parent; partial
and final deletion persist after relaunch. It uses the existing identity gate
and deletes its uniquely named group on success. A failed run can leave that
group behind; remove only its exact `QA-<run tag>-replylife-<attempt>` fixture.

Known iOS failure: after deleting one of two replies, the sibling and parent
remain but the channel badge reports `3 replies` instead of `1 reply`. A cold
relaunch corrects the badge to `1 reply` and the deleted body stays absent. The
exact immediate-count assertion remains intact, so the journey stops there and
does not yet reach its final-reply deletion checks on iOS. Android validation is
pending.

The separate `Maestro two-ship test` workflow runs on demand. It starts disposable
`~zod` and `~ten` ships on CI using this checkout's backend, exposes only `~zod`
through an IP-restricted tunnel, and reuses a qualified Android Cloud binary.
An API peer creates the group and sends a message; Maestro receives it, replies,
and sees the peer's acknowledgement without reloading. Group invitation opening
and filtering are covered; invitation submission and peer acceptance are not.
Dispatch `.github/workflows/maestro-fakeship-proof.yml` on this branch.

CI needs `MAESTRO_CLOUD_API_KEY` and `MAESTRO_FAKE_SHIP_NGROK_TOKEN`. The workflow
pins the Cloud project, binary, device, and CLI. Prepared ship snapshots are keyed
by backend/manifest inputs; a miss prepares cold ships, while a mismatched warm
snapshot fails quickly. App builds and local native caches are not involved.
The retained artifacts include backend hashes and the peer's delivery receipt.

Multiparty cases from the [Authenticated App QA sheet](https://docs.google.com/spreadsheets/d/1tm0wY5qzLxgBrym6W4rDMSn66b2w9IjWxHNU6Dabp_A/edit?gid=0):

| Rows | Case | Peer evidence |
| --- | --- | --- |
| 132-133 | Open Invite People and filter to `~ten` | Disposable native-hosted group is absent on both ships after cleanup |
| 455-456 | Select global mentions/replies and no-notification modes | Exact Activity events prove ordinary/mention/reply notification bits, the default is restored, and fixtures are deleted |
| 207-208 | Edit a mobile message | Same post ID has the edited text on the other ship |
| 209 | Delete that message | Other ship receives its deletion tombstone |
| 201-202 | Reply to a peer and receive a thread reply | Both replies have the expected authors under the same root; UI shows two replies and reopens them |

The global notification case intentionally fails its peer assertion while the
current backend marks a reply as notifying after the native client selects
`Nothing`. The flow still restores the default level and the peer deletes all
four case-owned fixture groups before reporting that product failure.

These run sequentially inside `exchange.yaml` to share one login and ship setup.
`peer-checks.json` records completed backend checks even if a later step fails;
Maestro must also pass before the run counts as successful.

DM request controls use isolated, opt-in cases because each case changes the
relationship between the same two ships. Dispatch `dm-deny`, `dm-block`, or
`dm-unblock` separately; the workflow rejects combinations with another DM case.

| Rows | Case | Peer evidence |
| --- | --- | --- |
| 340 | Deny an incoming request | The pending invite disappears without blocking the sender |
| 341 | Block an incoming requester | The sender is blocked, the invite disappears, and another send creates no invite |
| 462 | Unblock a blocked user | The ship disappears from the backend blocked set after native confirmation |

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
