# Edge Cases for Group Navigation on Removal (TLON-5140)

## Overview
The `useGroupContext` hook now automatically navigates users away when they lose access to a group (kick, ban, remove). This document outlines the edge cases considered and how they're handled.

## Edge Cases Identified & Mitigations

### 1. ✅ Initial Load (Group Still Loading)
**Scenario:** Component renders before group data has loaded from the database.

**Risk:** Navigation triggered on mount when `group` is `null` due to loading state.

**Mitigation:**
- Use `useRef` to track previous group state
- Only trigger navigation when transitioning from **valid → null**, not **null → anything**
- This prevents false positives during initial render

**Test Coverage:** `should NOT navigate when group is null on initial render`

---

### 2. ✅ Network Blip / Temporary Null
**Scenario:** Temporary network issue causes query to briefly return `null`, then recover.

**Risk:** User gets navigated away even though they still have group access.

**Trade-off Accepted:**
- If this happens, navigation will trigger once
- User can navigate back to the group
- This is considered acceptable given the rarity of this scenario vs. the importance of handling actual removals

**Test Coverage:** `should handle rapid transitions correctly (simulating network blip)`

**Alternative Considered (Not Implemented):**
- Add a debounce/delay before navigating
- **Rejected:** Would delay legitimate removal navigation and add complexity

---

### 3. ✅ Multiple Components Using Same Hook
**Scenario:** Multiple screens (e.g., GroupChannelsScreen, ChannelScreen) render simultaneously with the same `useGroupContext`.

**Risk:** Multiple navigation calls triggered.

**Mitigation:**
- React Navigation handles duplicate navigation calls gracefully (idempotent)
- Each hook instance manages its own ref, so navigation may fire multiple times
- This is acceptable behavior

**Test Coverage:** `should handle navigation when multiple components use the same hook`

---

### 4. ✅ Group Remains Null Across Renders
**Scenario:** Group is null and stays null across multiple re-renders.

**Risk:** Navigation triggered repeatedly.

**Mitigation:**
- `useRef` tracks that group was already null
- Navigation only fires on the **transition** from valid → null
- Subsequent renders with null don't trigger navigation

**Test Coverage:** `should NOT navigate multiple times if group stays null`

---

### 5. ✅ Switching Between Valid Groups
**Scenario:** User navigates from one valid group to another (e.g., via deep link or manual navigation).

**Risk:** Navigation triggered when switching groups.

**Mitigation:**
- Only triggers when `group === null`, not when group changes to a different valid group
- Valid → Valid transitions are ignored

**Test Coverage:** `should NOT navigate when switching between valid groups`

---

### 6. ✅ Valid Group Loads After Initial Null
**Scenario:** Group loads successfully after initial null/loading state.

**Risk:** Navigation triggered when group loads.

**Mitigation:**
- Ref tracks that previous state was null
- Only triggers on **valid → null**, not **null → valid**

**Test Coverage:** `should NOT navigate when group loads from null to valid`

---

## Wire Events Handled

The following Urbit sync events cause `group` to become `null` and trigger navigation:

1. **`removeGroupMembers`** - User kicked from group
2. **`banGroupMembers`** - User banned from group  
3. **`leaveChannel`** - User leaves (if they initiated)
4. Any other event that removes current user's membership

These events are processed in `packages/shared/src/store/sync.ts` and update the local database via:
- `db.removeChatMembers()`
- Which causes `store.useGroup()` to return `null`
- Which triggers our navigation effect

---

## Screens Protected

All screens using `useGroupContext` are now protected (15+ screens):

- GroupChannelsScreen
- ChannelScreen
- ChatDetailsScreen
- GroupMembersScreen
- EditChannelScreen
- ManageChannelsScreen
- GroupPrivacyScreen
- RoleFormScreen
- SelectRoleMembersScreen
- And more...

---

## Known Limitations

### Network Blip False Positive
If a network issue causes a brief query failure, the user may be navigated away from a group they still have access to. This is considered acceptable because:
- Rare occurrence
- User can navigate back immediately
- Better to err on the side of removing access than showing broken UI
- Alternative (debouncing) would delay legitimate removals

### Multiple Navigation Calls
Multiple component instances will each trigger navigation. This is harmless due to React Navigation's idempotent behavior, but could be optimized with:
- Global navigation state management
- Event bus pattern
- **Not implemented:** Added complexity not justified by the minor redundancy

---

## Testing Strategy

### Unit Tests (Vitest)
File: `packages/app/hooks/useGroupContext.test.ts`

Tests cover:
1. Initial load doesn't navigate
2. Valid → null triggers navigation (mobile & desktop)
3. Null → valid doesn't navigate
4. Group stays null doesn't re-navigate
5. Valid → valid switching doesn't navigate
6. Rapid transitions handled correctly
7. Multiple hook instances behavior

### Integration Testing Needed (Manual)
- [ ] Test actual kick event from Urbit
- [ ] Test actual ban event from Urbit
- [ ] Test on real devices (iOS/Android)
- [ ] Test on desktop build
- [ ] Test with slow network conditions
- [ ] Test with multiple tabs/windows (desktop)

---

## Future Improvements

### Potential Enhancements
1. **Add toast notification:** "You've been removed from this group"
2. **Debounce with smart timeout:** Delay navigation by 200-500ms to avoid network blip false positives
3. **Centralized navigation event bus:** Deduplicate navigation calls from multiple hook instances
4. **Differentiate removal types:** Show different UI for kick vs ban vs group deletion
5. **Add analytics:** Track when/how often this navigation is triggered

### Performance Considerations
- Current implementation adds minimal overhead (one ref, one effect per hook instance)
- Effect only runs when `group`, `navigation`, or `isWindowNarrow` change
- No network calls or expensive computations

---

## Related Files
- Hook: `packages/app/hooks/useGroupContext.ts`
- Tests: `packages/app/hooks/useGroupContext.test.ts`
- Sync Events: `packages/shared/src/store/sync.ts`
- Navigation Utils: `packages/app/navigation/utils.ts`

---

## Decision Log

| Decision | Rationale |
|----------|-----------|
| Track state with `useRef` instead of `useState` | Avoids extra re-renders, only need to detect transitions |
| Accept false positives from network blips | Rare edge case, better UX to remove than show broken UI |
| No debounce/delay | Prioritize immediate navigation for legitimate removals |
| Allow duplicate navigation calls | React Navigation handles it, not worth complexity to prevent |
| Centralized in hook vs individual screens | Single source of truth, protects all 15+ screens automatically |
