# Native reliability tests

Twenty-seven default single-ship journeys, including attachments, channel sorting,
Gallery links, profile details, pins, references, privacy, sections, notification
preferences, roles, replies, self-hosted login recovery and App Info clipboard verification.
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

`thread-lifecycle.yaml` also checks reply counts through 1 → 2 → 1 → 0: cancel
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
