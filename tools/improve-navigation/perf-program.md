# Frontend Performance Autoresearch — Agent Instructions

> Adapted from [karpathy/autoresearch](https://github.com/karpathy/autoresearch). You are an autonomous performance optimization agent. You modify frontend code, measure route-transition render times via Chrome DevTools, and keep only changes that improve the metric. You run in a loop until told to stop.

---

## 1. The metric

**p95 time-to-render (TTR)** across a fixed route-transition sequence. Lower is better. This is your val_bpb equivalent.

TTR is defined as the time from `navigation start` (the moment a client-side route change is triggered) to **Largest Contentful Paint (LCP)** on the destination route. If LCP is unavailable (SPA soft navigations), fall back to: the later of (a) the last layout-shifting element stabilizing (CLS settles) or (b) the DOM node count delta dropping below 5 for two consecutive 100 ms frames — i.e. the page is "done rendering."

Collect TTR for every transition in the route sequence (Section 3). The experiment's score is the **p95 of all collected TTR values**.

---

## 2. What you may edit

### Fair game (the "train.py")

-   Route-level page components (e.g. `packages/app/**`, `packages/ui/src/**`)
-   Bundler / build config (`vite.config.ts`, `webpack.config.js`, etc.)
-   Barrel exports / index files that affect tree-shaking
-   Suspense boundaries and lazy-loading wrappers
-   CSS extraction and critical CSS strategy
-   Prefetching / preloading hints (`<link rel="prefetch">`, router-level)
-   Memoization (`React.memo`, `useMemo`, `useCallback`)
-   Image loading strategy (`loading="lazy"`, priority hints)

### Read-only (the "prepare.py") — do NOT modify

-   The router library itself (react-router, @tanstack/router, etc.)
-   The data-fetching / state-management layer (e.g. react-query, urql, zustand)
-   Auth, session, and middleware
-   The dev server / CI pipeline
-   Test files

If you are unsure whether a file is fair game, **do not edit it**.

---

## 3. The route sequence

Adjust these routes to match the actual app. The sequence should exercise: cold load → list view → detail view → settings/heavy page → back-navigation.

```
ROUTE_SEQUENCE = [
  "/apps/groups/Home",               # cold load / landing
  "/apps/groups/group/~milsur-satbud%2Fv1jikjue/channel/heap%2F~milsur-satbud%2Fv2av4oti?screen=ChannelRoot&params=%5Bobject%20Object%5D",               # detail view (channel)
  "/apps/groups/group/~milsur-satbud%2Fv1jikjue/channel/heap%2F~milsur-satbud%2Fv2av4oti/EditChannelPrivacy?channelId=heap%2F~milsur-satbud%2Fv2av4oti&groupId=~milsur-satbud%2Fv1jikjue",            # settings panel (heavy, lots of form controls)
  "/apps/groups/group/~milsur-satbud%2Fv1jikjue/channel/heap%2F~milsur-satbud%2Fv2av4oti?screen=ChannelRoot&params=%5Bobject%20Object%5D",     # back-navigation (should be fast, cached)
]
```

**Warm-up:** Before measuring, navigate the full sequence once and discard all data. This mirrors autoresearch excluding compilation/startup from the 5-minute budget.

**Trials per experiment:** Navigate the full sequence **3 times** after warm-up. Collect TTR for each of the 5 transitions × 3 trials = 15 data points. Report the p95.

---

## 4. Measurement protocol (how to use Chrome DevTools MCP)

Each measurement cycle uses the following Chrome DevTools MCP tools. The `measure.js` harness (companion file) wraps this, but here is the logic so you understand what it does:

### 4a. Setup (once per experiment)

1. Ensure the dev server is running (`npm run dev` / `vite` / etc.).
2. Open or reuse a Chrome tab via `tabs_context_mcp` / `tabs_create_mcp`.
3. Navigate to the app's base URL.
4. Inject the performance observer via `javascript_tool`:

```js
// Injected into the page before measurements begin
window.__autoperf = { entries: [], marks: [] };
const obs = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
        window.__autoperf.entries.push({
            name: entry.name,
            entryType: entry.entryType,
            startTime: entry.startTime,
            duration: entry.duration,
            renderTime: entry.renderTime,
            loadTime: entry.loadTime,
            size: entry.size,
            url: entry.url,
            domContentLoadedEventEnd: entry.domContentLoadedEventEnd,
            loadEventEnd: entry.loadEventEnd,
        });
    }
});
obs.observe({ type: 'largest-contentful-paint', buffered: true });
obs.observe({ type: 'layout-shift', buffered: true });
obs.observe({ type: 'navigation', buffered: true });
obs.observe({ type: 'resource', buffered: true });
```

### 4b. Per-transition measurement

For each route in ROUTE_SEQUENCE:

1. Clear network requests: `read_network_requests` with `clear: true`.
2. Record `performance.now()` as `t_start` via `javascript_tool`.
3. Trigger the navigation. For SPA transitions, prefer clicking a link or calling `router.navigate('/path')` via `javascript_tool` rather than using the `navigate` MCP tool (which does a full page load). For the initial cold load, use `navigate`.
4. Poll for render completion (see Section 5).
5. Record `t_end` via `javascript_tool`.
6. Collect network waterfall via `read_network_requests`.
7. Collect performance entries via `javascript_tool`: `JSON.stringify(window.__autoperf.entries)`
8. Compute TTR = `t_end - t_start`.
9. Clear `window.__autoperf.entries = []` for next transition.

### 4c. After all trials

-   Gather all TTR values.
-   Compute p95 = sort ascending, take value at index `ceil(0.95 * n) - 1`.
-   Compare to previous best p95.

---

## 5. Render-completion detection

For SPA soft navigations, there is no native "load" event. Use this heuristic (executed via `javascript_tool` in a polling loop):

```js
// Inject once at the start of each transition measurement:
window.__autoperf._lastMutation = Date.now();
if (window.__autoperf._mutObs) window.__autoperf._mutObs.disconnect();
window.__autoperf._mutObs = new MutationObserver(() => {
    window.__autoperf._lastMutation = Date.now();
});
window.__autoperf._mutObs.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
});

// Poll function (call every 100ms via javascript_tool):
(() => {
    const now = Date.now();
    const mutationSettled = now - window.__autoperf._lastMutation > 200;
    const pendingResources = performance.getEntriesByType('resource').filter((r) => r.responseEnd === 0).length;
    const networkQuiet = pendingResources === 0;
    return { done: mutationSettled && networkQuiet, elapsed: now - window.__autoperf._tStart };
})();
```

Poll every 100ms. If `done` is true, stop — the page has rendered. If 10s elapses without settling, log a timeout warning and use 10000ms as the TTR (this is a penalty, not a skip).

---

## 6. Experiment loop

```
BEST_P95 = infinity
EXPERIMENT_NUM = 0

while true:
    EXPERIMENT_NUM += 1

    1. Read the current codebase. Decide on ONE change to try.
       - Review previous experiment log for ideas.
       - Prioritize high-impact, low-risk changes first.

    2. Describe the hypothesis in one sentence.
       e.g. "Lazy-loading the SettingsPage component will reduce
       initial bundle size and improve / → /settings TTR."

    3. Make the code change. Keep it minimal and atomic.
       One concept per experiment. No multi-variable changes.

    4. Ensure the app builds successfully.
       Run the build command. If it fails, revert and try again.

    5. Run the measurement protocol (Section 4).
       Record all 15 TTR values.

    6. Compute p95 TTR.

    7. Decision:
       - If p95 < BEST_P95 by at least the THRESHOLD:
         → KEEP. Git commit with message:
           "autoperf #{N}: {hypothesis} | p95: {old} → {new} ms"
         → Update BEST_P95.
       - If p95 >= BEST_P95 or improvement < THRESHOLD:
         → DISCARD. Git revert all changes.
         → Log: "autoperf #{N}: DISCARDED {hypothesis} | p95: {value} ms"

    8. Append to experiment log (Section 8).
```

---

## 7. Improvement threshold

Only keep a change if it improves p95 TTR by at least **25ms**.

This is higher than you might expect — it accounts for measurement noise in the browser. Unlike val_bpb on a fixed dataset, browser render times are noisy (GC pauses, layout thrash, background tabs). 25ms avoids false positives from noise.

If you find that your experiments are consistently producing improvements under 25ms, you may lower the threshold to 15ms after 10 consecutive discards, and note this in the log.

---

## 8. Experiment log format

Maintain a file `autoperf-log.md` in the project root:

```markdown
# Autoperf experiment log

| #   | Hypothesis             | p95 before | p95 after | Δ      | Decision   |
| --- | ---------------------- | ---------- | --------- | ------ | ---------- |
| 0   | Baseline               | —          | 892ms     | —      | baseline   |
| 1   | Lazy-load SettingsPage | 892ms      | 741ms     | -151ms | ✅ KEEP    |
| 2   | Memoize ChannelList    | 741ms      | 738ms     | -3ms   | ❌ DISCARD |

---

## Experiment 1

-   **Hypothesis:** Lazy-load SettingsPage to reduce main bundle
-   **Changed:** src/routes/settings.tsx — wrapped in React.lazy()
-   **p95 before:** 892ms
-   **p95 after:** 741ms (Δ -151ms)
-   **All TTR values:** [680, 710, 695, 741, 720, 688, 705, 731, 712, 699, 741, 708, 695, 721, 734]
-   **Network delta:** main bundle -47KB (312KB → 265KB)
-   **Decision:** ✅ KEEP
-   **Commit:** abc1234

## Experiment 2

-   **Hypothesis:** Memoize ChannelList with React.memo
-   **Changed:** src/components/ChannelList.tsx — wrapped export
-   **p95 before:** 741ms
-   **p95 after:** 738ms (Δ -3ms)
-   **Decision:** ❌ DISCARD (below 25ms threshold)
```

---

## 9. Ideas to explore (starter list)

The agent should try these roughly in priority order, but is free to diverge based on what the measurements reveal:

1. **Route-level code splitting** — React.lazy + Suspense for each route
2. **Remove barrel exports** — replace `import { X } from './components'` with direct imports to improve tree-shaking
3. **Preload adjacent routes** — on hover/focus of nav links, prefetch the next route's chunk
4. **Critical CSS extraction** — inline above-the-fold CSS, defer the rest
5. **Image optimization** — lazy-load offscreen images, add `fetchpriority` to hero images, use responsive `srcset`
6. **Memoize expensive renders** — wrap list items, heavy components in React.memo; audit useMemo/useCallback usage
7. **Reduce JS parse time** — identify and split large vendor chunks
8. **Font loading** — `font-display: swap`, preload critical fonts
9. **Third-party script audit** — defer or remove non-critical scripts
10. **Suspense boundaries** — add granular boundaries so partial UI renders while data loads

---

## 10. Constraints and safety

-   **Never break functionality.** If the app doesn't render correctly after a change, revert immediately. Use `read_page` to verify the page has the expected structure after each navigation.
-   **One change at a time.** Autoresearch's power comes from isolation. Multi-variable changes make the log useless.
-   **Don't fight the framework.** If a change requires patching node_modules or monkey-patching React internals, skip it.
-   **Don't optimize for the measurement.** No "if (measuring) skip animation" conditionals. The app should behave identically in measurement and production.
-   **Respect the read-only boundary.** The data layer, router, and auth are not yours to touch.

---

## 11. Supplementary diagnostics

After each experiment (whether kept or discarded), also record:

-   **Bundle size delta**: Compare total JS transferred during the route sequence. Use `read_network_requests` and sum `content-length` headers for `.js` and `.css` resources.
-   **Largest resource**: Identify the single largest JS chunk loaded during the sequence — this is often the best target for splitting.
-   **Long tasks**: Inject `PerformanceObserver` for `longtask` entries. Report any tasks > 50ms — these block the main thread and inflate TTR.

This secondary data helps the agent prioritize future experiments even when the primary metric doesn't change.

---

## 12. Getting started

```
1. Read this file.
2. Run `cat autoperf-log.md` to check for previous experiments.
   If the file doesn't exist, create it with the header.
3. Start the dev server if not already running.
4. Open Chrome DevTools MCP tab (tabs_context_mcp → tabs_create_mcp).
5. Navigate to the app and inject the performance observer (Section 4a).
6. Run one full warm-up + measurement cycle to establish the baseline.
7. Log the baseline as "Experiment 0 — Baseline".
8. Begin the experiment loop (Section 6).
```
