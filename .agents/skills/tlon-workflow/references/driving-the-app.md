# Driving the app

Read this before the first capture on a device. It is the mechanical half of
step 4: the workflow skill keeps the decisions, this keeps the traps.

`<bundle id>` below is `io.tlon.groups`, or `io.tlon.groups.preview` when the
run is on a preview build. Granting or relaunching the other one leaves the
app you are driving untouched.

To capture a "before" after the fix is already committed (a reviewer asks for another case), swap the file, not the branch: `git checkout origin/develop -- <path>`, record under Fast Refresh, then `git checkout HEAD -- <path>`.

`--quality high` records at device resolution; the default is 220x480, which loses anything smaller than a button. `press` and `longpress` are the interaction commands -- there is no `tap`. Dialogs, action sheets and long-press targets resolve by `[button]` ref from a fresh snapshot, not by `text=`; in a sequence too fast to re-snapshot, press coordinates from the last snapshot. The chat list does not respond to `scroll`; `swipe x1 y1 x2 y2` moves it, and the header Search is the reliable way to a group (tap the result twice: the first tap only dismisses the keyboard). On Android the list collapses into one label, and a ref has opened another agent's group: read the channel header before posting anything, and tap the list by screenshot coordinates.

Attachments: the emulator has no photos (`adb push` one, then `am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file://<path>`); on iOS grant photo access before opening the app (`xcrun simctl privacy <udid> grant photos <bundle id>`), because `alert dismiss` on the permission prompt denies it and the recovery relaunches the app; the composer's `+` has no label, so it takes coordinates.

Backgrounding, when the ticket or the variation calls for it: `agent-device home --session <name>` on either device; back with `xcrun simctl launch <udid> <bundle id>` on iOS and `adb -s <serial> shell am start -n <bundle id>/io.tlon.landscape.MainActivity` on Android. A system activity over the app is `adb shell am start -a android.settings.INPUT_METHOD_SETTINGS`.

Making a throwaway group: Home `Add a chat` → `New group` → `Basic group` (a chat, a gallery and a notebook channel) → name → `Next` → `Create group`; on iOS the group-type cards and those two buttons are `[other]` nodes that a ref does not press, so use coordinates from a screenshot. Refs come back from a `--settle` diff as `@eN~sNNN`; use that full form, a bare `@eN` is refused after the tree changed.

When a label is too long for the screen, read the text (`agent-device snapshot`) rather than trusting the picture.

`scroll --until` selectors tokenize on whitespace, so a multi-word value needs its own double quotes inside the single-quoted argument -- `--until 'label="Channel settings"'` -- or it fails with `Invalid selector term "an", expected key=value`.
