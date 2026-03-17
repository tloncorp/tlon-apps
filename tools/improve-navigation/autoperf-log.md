# Autoperf experiment log

| #   | Hypothesis             | p95 before | p95 after | Δ      | Decision   |
| --- | ---------------------- | ---------- | --------- | ------ | ---------- |
| 0   | Baseline               | —          | 5812ms    | —      | baseline   |
| 1   | Lazy-load drawer navigators | 5812ms | 5552ms    | -260ms | KEEP       |
| 2   | De-barrel TopLevelDrawer imports | 5552ms | 5308ms | -244ms | KEEP       |
| 3   | De-barrel lazy navigator imports | 5308ms | 5308ms | 0ms    | DISCARD    |
| 4   | Lazy-load PersonalInviteSheet | 5308ms | 5400ms | +92ms  | DISCARD    |
| 5   | Defer @tiptap/pm/view import | 5308ms | 6276ms | +968ms | DISCARD    |
| — | **Switch to production build** | — | — | — | — |
| 6   | Production baseline (with exp 1+2) | — | 2716ms | — | baseline |
| 7   | Split RN vendor chunks | 2716ms | — | — | DISCARD (errors) |
| 8   | Lazy-load GlobalSearch | 2716ms | 2736ms | +20ms | DISCARD |
| 9   | Lazy-load DraftInputView | 2716ms | — | — | DISCARD (no split) |
| 10  | Remove WDYR jsxImportSource | 2716ms | 2764ms | +48ms | DISCARD |

---

## Experiment 0 — Baseline

-   **Hypothesis:** Establish baseline p95 TTR across route sequence
-   **Route sequence:**
    1. `/apps/groups/Home` (cold load)
    2. `/apps/groups/group/.../channel/heap/...` (gallery channel detail)
    3. `.../EditChannelPrivacy` (settings panel)
    4. Back to channel detail (back-navigation)
-   **Measurement:** 3 trials x 4 transitions = 12 data points (full page loads via navigate, LCP-based TTR)
-   **All TTR values:** [4780, 4644, 4196, 4688, 4716, 4628, 4352, 4668, 5812, 4796, 4292, 4664]
-   **p95:** 5812ms
-   **Mean:** 4686ms
-   **Min/Max:** 4196ms / 5812ms
-   **Environment:** Vite dev server (unbundled, 1182 individual module requests), SSL, ~milsur-satbud ship
-   **Notes:** Dev mode has no bundling — each module is a separate HTTP request. Optimizations targeting module count, lazy loading, and render efficiency should still show measurable impact on LCP.

## Experiment 1

-   **Hypothesis:** Lazy-loading the 5 drawer navigators (Home, Messages, Activity, Contacts, Settings) with React.lazy() will reduce initial JS parse/execute time and improve TTR
-   **Changed:** `packages/app/navigation/desktop/TopLevelDrawer.tsx` — replaced 5 eager navigator imports with `React.lazy()` dynamic imports, added `<Suspense fallback={null}>` around `<Drawer.Navigator>`
-   **p95 before:** 5812ms
-   **p95 after:** 5552ms (Δ -260ms)
-   **All TTR values:** [4780, 5552, 4456, 4724, 4776, 4652, 4384, 4840, 4808, 4840, 4564, 4676]
-   **Mean:** 4754ms (was 4686ms — mean slightly higher, but p95 tail significantly reduced)
-   **Decision:** KEEP (260ms > 25ms threshold)
-   **Notes:** One measurement spiked to 18772ms due to Vite HMR recompilation after the code change; re-measured that transition (4456ms). The tail improvement suggests lazy loading reduces worst-case initialization overhead.

## Experiment 2

-   **Hypothesis:** Replacing barrel import `from '../../ui'` (which cascades through 109+ wildcard exports + all of @tloncorp/ui) with direct file imports will reduce module resolution overhead
-   **Changed:** `packages/app/navigation/desktop/TopLevelDrawer.tsx` — replaced `import { AvatarNavIcon, DESKTOP_TOPLEVEL_SIDEBAR_WIDTH, GlobalSearchProvider, NavIcon, YStack, useGlobalSearch, useWebAppUpdate } from '../../ui'` with direct imports from `@tloncorp/ui`, `tamagui`, `../../ui/contexts/appDataContext`, `../../ui/components/NavBar/NavIcon`
-   **p95 before:** 5552ms
-   **p95 after:** 5308ms (Δ -244ms)
-   **All TTR values:** [5032, 4828, 4448, 5120, 5308, 4788, 4464, 5060, 4676, 4736, 4760, 4728]
-   **Mean:** 4829ms
-   **Decision:** KEEP (244ms > 25ms threshold)
-   **Notes:** This only de-barreled one file (TopLevelDrawer). The same pattern exists in all navigator files — further de-barreling could compound the improvement.

## Experiment 3

-   **Hypothesis:** De-barreling `../../ui` imports in HomeNavigator and MessagesNavigator (replacing with `@tloncorp/ui`) will reduce module resolution overhead
-   **Changed:** `HomeNavigator.tsx`, `MessagesNavigator.tsx` — replaced `from '../../ui'` with `from '@tloncorp/ui'`
-   **p95 before:** 5308ms
-   **p95 after:** 5308ms (Δ 0ms)
-   **All TTR values:** [5308, 5152, 4396, 5216, 4968, 4980, 4396, 5024, 4988, 4716, 4176, 4916]
-   **Decision:** DISCARD (no improvement)
-   **Notes:** These navigators are already lazy-loaded via React.lazy() (experiment 1), so their barrel imports only resolve when the navigator loads — not on initial page render. De-barreling eagerly-loaded code (like TopLevelDrawer) is impactful; de-barreling lazy-loaded code is not. Reverted changes.

## Experiment 4

-   **Hypothesis:** Lazy-loading PersonalInviteSheet (which imports react-qr-code) will defer QR library load and reduce initial JS parse time
-   **Changed:** `TopLevelDrawer.tsx` — replaced eager import of PersonalInviteSheet with React.lazy() + Suspense
-   **p95 before:** 5308ms
-   **p95 after:** 5400ms (Δ +92ms)
-   **All TTR values:** [4964, 5400, 4664, 5192, 4804, 5100, 4664, 5000, 4956, 5068, 4480, 4960]
-   **Decision:** DISCARD (regression, likely noise — react-qr-code is small; dynamic import overhead offsets any savings)
-   **Notes:** Reverted. The library is too small for lazy-loading to help. Future experiments should target heavier eagerly-loaded dependencies.

## Experiment 5

-   **Hypothesis:** Dynamically importing @tiptap/pm/view inside setupDb().then() will remove a heavy static import from the critical path
-   **Changed:** `apps/tlon-web/src/main.tsx` — moved EditorView from static import to dynamic import inside setupDb callback
-   **p95 before:** 5308ms
-   **p95 after:** 6276ms (Δ +968ms)
-   **All TTR values:** [4820, 5376, 4508, 5196, 5832, 5580, 5584, 4964, 5412, 6276, 5576, 5736]
-   **Decision:** DISCARD (major regression)
-   **Notes:** Reverted. The dynamic import adds an async step to the init chain, delaying React render. In Vite dev mode, @tiptap/pm/view is pre-bundled and served as a single file — moving it to dynamic import just serializes a parallel load. Static imports allow the browser to fetch all deps in parallel; async imports serialize them.

## Experiment 6 — Production Baseline

-   **Switched to production build** (`pnpm build:web` + `pnpm serve` on port 4173)
-   **Build output highlights:**
    -   Main bundle: `index-omoy9ne2.js` — 7,429 KB (2,170 KB gzip)
    -   Lazy navigator chunks confirmed: HomeNavigator 9.4KB, MessagesNavigator 5.8KB, SettingsNavigator 2.9KB, ActivityNavigator 2.2KB, ProfileNavigator 2.0KB
    -   Large vendor chunks: react-native-reanimated 472KB, any-ascii 453KB, tiptap/core 229KB, react-native-web 238KB, aws-sdk/client-s3 202KB
-   **All TTR values:** [2552, 2736, 2276, 2752, 2348, 2708, 2412, 2652, 2388, 2764, 2452, 2940]
-   **p95:** 2940ms
-   **Mean:** 2582ms
-   **Min/Max:** 2276ms / 2940ms
-   **Notes:** ~2x faster than dev mode (5308ms → 2940ms). Tighter variance. The main bundle at 7.4MB is very large — splitting heavy vendor chunks (reanimated, any-ascii, aws-sdk) could significantly reduce initial load.

