# Security Audit - OpenClaw Tlon Plugin

**Date:** 2026-01-30  
**Auditor:** Nimbus (~tolber-nocneb)  
**Scope:** `src/` directory (~5000 LoC TypeScript)

---

## Summary

Overall security posture: **MODERATE** - No critical vulnerabilities found, but several areas could be hardened.

| Severity | Count | Status |
| -------- | ----- | ------ |
| Critical | 0     | ✅     |
| High     | 1     | ⚠️     |
| Medium   | 3     | ⚠️     |
| Low      | 4     | 📝     |

---

## Findings

### HIGH: Auto-Accept Group Invites Trusts All Inviters

**File:** `src/monitor/index.ts` (lines ~780-820)  
**Issue:** When `autoAcceptGroupInvites` is enabled, the plugin accepts invites from ANY ship without validation.

```typescript
// Current code accepts all valid invites
const validInvite = foreign.invites.find((inv) => inv.valid);
if (!validInvite) continue;
// Auto-joins without checking who sent it
```

**Risk:** Malicious actors could invite the bot to groups containing:

- Prompt injection content in channel names/descriptions
- Spam/phishing content
- Content that could manipulate agent behavior

**Recommendation:** Add an `autoAcceptGroupInvitesFrom` allowlist similar to `dmAllowlist`:

```typescript
// Only auto-accept from trusted ships
if (!isInviteAllowed(validInvite.from, allowlist)) continue;
```

---

### MEDIUM: No Rate Limiting on Outbound Messages

**File:** `src/urbit/send.ts`  
**Issue:** No rate limiting on `sendDm()` or `sendGroupMessage()`. A compromised agent could spam channels.

**Risk:** If the agent is manipulated (prompt injection), it could flood channels with messages.

**Recommendation:** Add rate limiting per channel/DM:

```typescript
const rateLimiter = new Map<string, number>(); // channel -> lastSentTime
const MIN_MESSAGE_INTERVAL = 1000; // 1 second minimum
```

---

### MEDIUM: Auth Code Not URL-Encoded

**File:** `src/urbit/auth.ts` (line 6)  
**Issue:** Ship code is sent without URL encoding:

```typescript
body: `password=${code}`,
```

**Risk:** If a code contains special characters (`&`, `=`, `+`), authentication could fail or behave unexpectedly.

**Recommendation:**

```typescript
body: `password=${encodeURIComponent(code)}`,
```

---

### MEDIUM: Cookie Handling Truncation

**File:** `src/urbit/sse-client.ts` (line 49)  
**Issue:** Cookie is split and only first part used:

```typescript
this.cookie = cookie.split(";")[0];
```

**Risk:** May discard important cookie attributes. While functional, this is fragile.

**Recommendation:** Use proper cookie parsing or document why truncation is safe.

---

### LOW: No Input Sanitization on Channel Names

**File:** `src/targets.ts`  
**Issue:** Channel nests from config are used directly without sanitization.

**Risk:** Malformed channel names could cause unexpected behavior.

**Recommendation:** Validate channel nest format strictly:

```typescript
const VALID_NEST = /^(chat|diary|heap)\/~[a-z]+-[a-z]+\/[a-z0-9-]+$/;
if (!VALID_NEST.test(nest)) throw new Error("Invalid channel nest");
```

---

### LOW: Message History in Summarization Unbounded

**File:** `src/monitor/index.ts` (line ~270)  
**Issue:** Summarization fetches 50 messages and includes full history in prompt.

**Risk:**

- Could exceed token limits
- Could expose sensitive historical content

**Recommendation:** Add configurable limit and content filtering.

---

### LOW: No Validation on Settings Store Values

**File:** `src/settings.ts`  
**Issue:** Settings from Urbit settings-store are parsed but not validated against schema.

**Risk:** Malformed settings could cause runtime errors.

**Recommendation:** Validate settings against Zod schema before use.

---

### LOW: Reconnection Logging May Expose Timing

**File:** `src/urbit/sse-client.ts`  
**Issue:** Reconnection attempts are logged with timing information.

**Risk:** Minor information disclosure about connection state.

**Recommendation:** Make verbose logging configurable.

---

## Positive Findings

✅ **No secrets in logs** - Credentials are not logged  
✅ **No code execution** - No eval/Function/exec usage  
✅ **Type safety** - Full TypeScript with Zod validation on config  
✅ **No hardcoded secrets** - All credentials from config/env  
✅ **Proper async handling** - No obvious race conditions  
✅ **SSE ack tracking** - Prevents channel backup/DOS

---

## Recommendations Summary

1. **Immediate:** Add inviter allowlist for auto-accept group invites
2. **Short-term:** URL-encode auth code, add rate limiting
3. **Long-term:** Add settings validation, input sanitization

---

## Files Reviewed

- `src/urbit/auth.ts` - Authentication
- `src/urbit/sse-client.ts` - SSE connection handling
- `src/urbit/send.ts` - Outbound messages
- `src/monitor/index.ts` - Message processing
- `src/monitor/utils.ts` - Input parsing
- `src/settings.ts` - Settings store
- `src/config-schema.ts` - Config validation
- `src/types.ts` - Type definitions
- `src/targets.ts` - Channel/ship parsing
