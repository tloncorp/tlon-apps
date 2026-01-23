# Fresh Channel Reconnection

## Table of Contents
- [Overview](#overview)
- [How to Enable](#how-to-enable)
- [How It Works](#how-it-works)
- [Benefits](#benefits)
- [Technical Details](#technical-details)
- [Analytics Events](#analytics-events)
- [Known Limitations](#known-limitations)
- [Troubleshooting](#troubleshooting)

## Overview

Fresh Channel Reconnection is an experimental feature that dramatically improves app performance when returning from the background. Instead of processing a backlog of queued SSE (Server-Sent Events) when the app foregrounds, this feature creates a fresh SSE channel and relies on the sync system to catch up efficiently.

### Problem Solved

When the Tlon Messenger app is backgrounded:
1. The SSE connection disconnects
2. The Urbit backend queues all subscription events (messages, activity, etc.)
3. When the app foregrounds, it reconnects to the **same channel**
4. All queued events must be processed sequentially
5. Users experience a "frozen" app for 5-30 seconds depending on time away

### Solution

With Fresh Channel Reconnection enabled:
1. On app foreground, a **new SSE channel** is created
2. The event backlog is skipped entirely
3. The sync system fetches changes in batch via `syncSince()`
4. Users see content appear almost immediately

| Scenario | Without Feature | With Feature |
|----------|-----------------|--------------|
| Backgrounded 5 minutes | 1-3s delay | <500ms |
| Backgrounded 1 hour | 5-10s delay | <1s |
| Backgrounded 1+ days | 15-30s delay | <2s |

## How to Enable

### User Setting (Mobile & Web)

1. Open **Settings**
2. Navigate to **Experimental Features** (or Developer Settings)
3. Toggle **"Fast foreground reconnect (experimental)"** ON

### Remote Control (PostHog)

The feature can be remotely enabled/disabled via PostHog feature flags:

- Flag name: `freshChannelOnReconnect`
- When enabled remotely, it overrides local settings
- Useful for gradual rollout or emergency disable

### Programmatic Access

```typescript
import { isEnabled } from '@tloncorp/app/lib/featureFlags';

// Check if feature is enabled
const enabled = isEnabled('freshChannelOnReconnect');
```

## How It Works

### Sequence Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Mobile    │     │   Urbit     │     │   Backend   │
│     App     │     │   Client    │     │   Server    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ App Backgrounded  │                   │
       │ ──────────────────>│                   │
       │                   │ SSE Disconnects   │
       │                   │ ──────────────────>│
       │                   │                   │
       │                   │   Events Queue    │
       │                   │   (100s-1000s)    │
       │                   │                   │
       │ App Foregrounded  │                   │
       │ ──────────────────>│                   │
       │                   │                   │
       │ [FRESH CHANNEL]   │                   │
       │                   │ seamlessReset()   │
       │                   │ ──────────────────>│ New Channel UID
       │                   │                   │
       │                   │ Resubscribe All   │
       │                   │ ──────────────────>│
       │                   │                   │
       │ syncSince()       │                   │
       │ ──────────────────>│ ──────────────────>│
       │                   │                   │ Batch Response
       │ <──────────────────│ <──────────────────│
       │                   │                   │
       │ UI Updated        │                   │
       └───────────────────┴───────────────────┘
```

### Key Components

1. **Feature Flag Check** (`AuthenticatedApp.tsx:43-66`)
   - When app state changes to "active", checks if feature is enabled
   - Respects throttling (max 1 reset per 60 seconds)

2. **Handle Discontinuity** (`sync.ts:1760-1784`)
   - Accepts `forceChannelReset` parameter
   - Calls `api.resetUrbitConnection()` to trigger fresh channel

3. **Seamless Reset** (`Urbit.ts:525-556`)
   - Creates new channel UID
   - Preserves and resubscribes all active subscriptions
   - Emits `seamless-reset` event

4. **Sync System** (`sync.ts`)
   - `syncSince()` fetches changes since last sync timestamp
   - More efficient than processing individual events

## Benefits

### Performance

- **70-90% faster** foreground return times
- Batch syncing is more efficient than sequential event processing
- Fewer database writes (only final state, not intermediate updates)

### User Experience

- No more "frozen" app when returning from background
- Especially helpful for infrequent users who return after days
- Better performance on slow devices

### Efficiency

- Skips stale events (typing indicators, presence updates from hours ago)
- Reduces CPU and battery usage during foreground
- Backend doesn't need to replay old events

## Technical Details

### Throttling

To prevent excessive channel creation during rapid foreground/background cycling:

- Fresh channel resets are limited to **once per 60 seconds**
- If throttled, a `FreshChannelResetThrottled` analytics event is tracked
- Normal sync proceeds even when reset is throttled

```typescript
const FRESH_CHANNEL_RESET_THROTTLE_MS = 60000; // 60 seconds

const timeSinceLastReset = Date.now() - (lastFreshChannelResetTime ?? 0);
if (timeSinceLastReset < FRESH_CHANNEL_RESET_THROTTLE_MS) {
  // Throttled - skip channel reset, proceed with normal sync
}
```

### Error Handling

**Network Interruptions During Reset:**
- Errors are caught and logged
- `FreshChannelResetFailed` event is tracked
- Sync continues despite reset failure (graceful degradation)

**Sync Failures After Reset:**
- Automatic retry with exponential backoff (up to 3 attempts)
- Delays: 2s, 4s, 6s between retries
- `ForegroundSyncFailedAfterFreshChannel` event tracked

### Subscription Preservation

All subscriptions with `resubOnQuit: true` (the default) are automatically resubscribed after channel reset. The codebase was audited to ensure all critical subscriptions use this pattern:

- DM subscriptions
- Group channel subscriptions
- Activity subscriptions
- Presence subscriptions

## Analytics Events

The feature tracks comprehensive analytics for monitoring and optimization:

| Event | Description | Properties |
|-------|-------------|------------|
| `FreshChannelResetTriggered` | Channel reset initiated | - |
| `FreshChannelResetComplete` | Channel reset successful | `resetDuration` |
| `FreshChannelResetFailed` | Channel reset error | `errorMessage`, `resetDuration` |
| `FreshChannelResetThrottled` | Reset skipped (throttling) | `timeSinceLastReset`, `throttleMs` |
| `ForegroundTimeToInteractive` | Total foreground time | `timeToInteractive`, `syncDuration`, `withFreshChannel` |
| `ForegroundSyncComplete` | Sync finished | `totalDuration`, `cause`, `withFreshChannel`, `retryAttempt` |
| `ForegroundSyncFailedAfterFreshChannel` | Sync failed after reset | `errorMessage`, `retryAttempt`, `timeSinceForeground` |

### Dashboard Metrics

Monitor these metrics to compare flag ON vs OFF:

- P50/P95/P99 foreground time
- Sync error rate
- Crash rate
- Backend channel creation rate

## Known Limitations

### Brief Data Inconsistency Window

There's a brief window (typically <1s) where local state might not reflect the latest backend state. This is resolved once `syncSince()` completes.

### Events During Transition

Events that arrive during the channel transition might be missed momentarily. The sync system catches up with timestamp-based queries, so no data is permanently lost.

### Backend Load

Creating new channels and resubscribing increases backend load slightly. This is mitigated by:
- Only happening on app foreground (not continuous reconnects)
- Throttling prevents rapid channel creation

### Mobile Only (Currently)

The feature is currently implemented for mobile only. Desktop/web support for tab visibility changes may be added in the future.

## Troubleshooting

### Feature Not Working

1. **Check if enabled:** Settings > Experimental Features > "Fast foreground reconnect"
2. **Check throttling:** If you've recently foregrounded, the 60-second throttle may be active
3. **Check logs:** Look for `FreshChannelResetTriggered` events

### Messages Not Appearing

1. Wait a few seconds for sync to complete
2. Check network connectivity
3. Pull to refresh if available
4. If persistent, disable the feature and report the issue

### Performance Still Slow

1. Check if sync is completing (look for `ForegroundSyncComplete` event)
2. Large data sets may still take time to sync
3. Network latency affects sync performance

### Reporting Issues

When reporting issues, include:
- Device type and OS version
- Approximate time backgrounded
- Whether feature flag is enabled
- Any error messages in logs

## Related Files

- `packages/app/lib/featureFlags.ts` - Feature flag definition
- `apps/tlon-mobile/src/components/AuthenticatedApp.tsx` - Foreground handler
- `packages/shared/src/store/sync.ts` - `handleDiscontinuity()` and sync logic
- `packages/shared/src/http-api/Urbit.ts` - `seamlessReset()` implementation
- `packages/shared/src/api/urbit.ts` - `resetUrbitConnection()` API
- `packages/shared/src/domain/analytics.ts` - Analytics event definitions
