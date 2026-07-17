# Driving the Android app over adb

Everything here is wrapped by `scripts/adbx.sh`; this file explains the traps so
the wrapper's behavior makes sense and you know which command to reach for.

## Locating adb

adb is frequently not on PATH. Common real locations on macOS:

- `/opt/homebrew/share/android-commandlinetools/platform-tools/adb` (Homebrew `android-commandlinetools`)
- `~/Library/Android/sdk/platform-tools/adb` (Android Studio)

`adbx.sh` searches these; if it can't find adb, install/point at one before continuing.

## Screenshots and the coordinate model

- Capture with `adbx.sh shot <name>` (`adb exec-out screencap -p > file.png`), then
  **view the PNG** (image input required) to see the screen.
- The screenshot is the device's **native resolution** (e.g. 1080×2400). Your
  image viewer may *display* it scaled and mention a multiply factor — that factor
  is for reading the displayed image, **not** for input.
- `input tap`/`input swipe` use **device-native coordinates**. So tap the raw
  pixel coordinate as it appears in the native-resolution screenshot; do **not**
  multiply by the viewer's display-scale factor. Getting this wrong makes every
  tap land slightly off.

## When a tap keeps missing: read the real bounds

Guessing a control's center from a screenshot is the #1 cause of wrong taps
(e.g. tapping "New channel" but hitting "New section" because the rows were
closer together than they looked). Instead of re-guessing, dump the accessibility
tree and use exact bounds:

```bash
adbx.sh bounds "New channel"     # prints bounds="[x1,y1][x2,y2]" for matches
# tap the center: ((x1+x2)/2, (y1+y2)/2)
```

`adbx.sh ui` dumps the whole tree if you need to find nearby elements or a
resource-id/testID. Element `testID`s render as `content-desc` (or resource-id)
in the dump — searching by the testID you set in code is often the fastest anchor.

## Gestures that have sharp edges

### RN swipeable rows / reorderable lists: use `drag`, not `swipe`

React Native's pan-gesture rows (swipe-to-mark-read, drag-to-reorder channels)
treat a fast `adb input swipe` as a **fling** and snap back — nothing is revealed
or moved. Use `adbx.sh drag x1 y1 x2 y2`, which issues discrete `motionevent
DOWN/MOVE.../UP` with small holds so the pan responder engages.

- **Swipe-to-reveal an action** (e.g. mark-read check on a home-list row): drag a
  short distance right and stop; the action button appears, then `tap` it.
  Note the action only appears when it's applicable — the mark-read check only
  shows on rows that actually have unreads.
- **Drag-to-reorder / drag-into-section**: even a controlled `drag` may not
  reliably trigger RN reorderable lists via synthetic events. If it won't take
  after a couple of honest attempts, record the test as `NOT RUN — drag-and-drop
  not reliably triggerable via adb` rather than reporting a false FAIL. It's an
  automation limit, not necessarily an app defect.

### Long-press

`adbx.sh longpress x y` (a zero-distance swipe held ~800ms) opens context sheets
(long-press a group/channel/message).

### Typing: spaces truncate `input text`

`adb shell input text "two words"` sends the space as a word-break and drops
everything after it — you get "two". Options: type one word at a time, or accept
that only the first token lands (often fine for QA where any non-empty value
works). Don't assume a multi-word string went in; screenshot and check.

To clear a field: focus it, `key 123` (move-end), then repeat `key 67` (DEL) once
per character, then type the new value.

### Dismissing the keyboard without dismissing the sheet

Inside a bottom sheet, `key 4` (Back) dismisses the **whole sheet**, not just the
keyboard — and one Back too many exits the app to the launcher. To drop just the
keyboard, tap the keyboard's hide-chevron (bottom-left of the IME) or tap a
neutral area of the sheet. After a keyboard show→hide, re-screenshot before
tapping header buttons; some screens re-layout and controls move.

## The device sleeps and locks during long steps

A physical device sleeps on its own timeout — screenshots taken after that come
back **all black**, and it may be sitting on the lockscreen (`dumpsys window`
shows `mDreamingLockscreen=true`, focus `NotificationShade`).

- `adbx.sh stayon` (`svc power stayon true`) keeps the screen on **while charging** —
  set it at the start of any pass that includes a long build.
- `adbx.sh wake` sends a wake key.
- A **secure lockscreen** (PIN/pattern) must be unlocked by the user. Never try to
  enter or bypass a PIN. Ask the user to unlock and leave the device on, then continue.

## Relaunching / navigating

- `adbx.sh launch io.tlon.groups.preview` cold-launches the app.
- `adbx.sh stop io.tlon.groups.preview` force-stops it.
- `adbx.sh focus` shows the focused activity — useful to confirm you're actually
  in the app and not on the launcher/lockscreen.
