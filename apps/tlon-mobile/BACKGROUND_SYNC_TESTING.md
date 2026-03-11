# Background Sync Testing (Android)

The `DebugBgSyncReceiver` lets you trigger background sync on-demand via ADB while the app is backgrounded. It is only included in **debug builds** (via the `src/debug/` source set).

## Prerequisites

- A debug build of the app installed on the device/emulator
- ADB connected (`adb devices` shows your target)

## Trigger Background Sync

Background the app first (press Home), then send the broadcast:

### Production flavor (`io.tlon.groups`)

```sh
adb shell am broadcast \
  -a io.tlon.landscape.DEBUG_BG_SYNC \
  -n io.tlon.groups/io.tlon.landscape.DebugBgSyncReceiver
```

### Preview flavor (`io.tlon.groups.preview`)

```sh
adb shell am broadcast \
  -a io.tlon.landscape.DEBUG_BG_SYNC \
  -n io.tlon.groups.preview/io.tlon.landscape.DebugBgSyncReceiver
```

The `-n` (component) flag is required on Android 8+ for explicit broadcast delivery to non-system receivers.

## Watch Logs

Filter logcat to the receiver's tag:

```sh
adb logcat -s DebugBgSyncReceiver:* BackgroundTask:*
```

## Expected Output

A successful run looks like:

```
I/DebugBgSyncReceiver: Received broadcast, triggering background sync
I/DebugBgSyncReceiver: Background sync completed
```

If something goes wrong you'll see:

```
E/DebugBgSyncReceiver: Background sync failed: <error message>
```

## Notes

- The receiver is **debug-only** — it does not exist in release/production APKs.
- The broadcast triggers `BackgroundTaskScheduler.runTasks()`, which is the same code path used by the real OS-scheduled background task.
- You can run this while the app is in the foreground too, but testing from the background is the interesting case.
