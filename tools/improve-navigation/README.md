# autoperf

Autonomous frontend performance optimization, adapted from
[karpathy/autoresearch](https://github.com/karpathy/autoresearch).

An AI agent modifies your frontend code, measures route-transition render
times via Chrome DevTools MCP, and keeps only changes that improve the
metric. You sleep; it optimizes.

## How it maps to autoresearch

| autoresearch | autoperf |
|---|---|
| `program.md` — human-written research strategy | `perf-program.md` — human-written perf targets + constraints |
| `train.py` — agent-editable training code | Your route components + bundler config |
| `prepare.py` — read-only infrastructure | Router, data layer, auth (read-only) |
| `uv run train.py` — 5 min GPU training | N route navigations via Chrome DevTools |
| `val_bpb` — the metric (lower = better) | `p95 TTR` — the metric (lower = better) |
| Git commit / revert | Git commit / revert |

## Files

```
perf-program.md       — Agent instructions (the "program.md" equivalent)
measure-snippets.js   — JS snippets injected via Chrome DevTools MCP
autoperf-log.md       — Experiment log (created by agent at runtime)
```

## Requirements

- A React webapp with a dev server (Vite, webpack, etc.)
- Chrome with the Claude in Chrome extension (MCP tools)
- Git initialized in the project repo
- An AI agent (Claude) with access to:
  - Chrome DevTools MCP (navigate, javascript_tool, read_network_requests, etc.)
  - Filesystem tools (to edit source files and write the log)

## Quick start

1. Copy `perf-program.md` and `measure-snippets.js` into your project root.
2. Edit Section 3 of `perf-program.md` to match your app's actual routes.
3. Edit Section 2 to specify which files/directories the agent may touch.
4. Start your dev server.
5. Prompt the agent:

```
Read perf-program.md and let's start. Do the setup, establish a baseline,
then begin the experiment loop.
```

6. Walk away. Check `autoperf-log.md` in the morning.

## The measurement loop

Each experiment cycle:

1. Agent picks ONE code change (e.g., lazy-load a route component)
2. App rebuilds (HMR or full rebuild)
3. Chrome DevTools MCP navigates a fixed route sequence 3× (+ 1 warm-up)
4. JS snippets collect TTR via PerformanceObserver + MutationObserver
5. Agent computes p95 of all TTR measurements
6. If p95 improved by ≥25ms → git commit. Otherwise → git revert.
7. Log the result. Repeat.

## Adapting for your app

The default `perf-program.md` assumes a messaging/collaboration app
(channels, settings, etc.). To adapt:

- **Route sequence**: Replace with your app's actual navigation flow.
  Include cold load, list views, detail views, and back-navigation.
- **Editable files**: Scope to your route-level components and build config.
  Keep the data layer and router read-only.
- **Threshold**: 25ms default. Lower to 15ms if your app is already fast
  and you're chasing small wins.
- **Ideas list**: Replace with optimizations relevant to your stack
  (e.g., SSR hydration, RSC streaming, island architecture).

## Why p95 TTR?

- **p95** because median hides the bad cases. Your worst transitions are
  what users actually feel.
- **TTR** (time to render) because it's what the user sees — not TTFB,
  not DOMContentLoaded, but actual pixels on screen.
- **Route transitions** because SPAs spend most of their time navigating
  between views, not on the initial cold load (which is well-covered by
  Lighthouse already).

## Noise handling

Browser measurements are noisier than ML training metrics. The system
accounts for this:

- 3 trials per experiment (15 total data points) for statistical stability
- 25ms minimum improvement threshold to avoid keeping noise
- Warm-up pass to prime caches and JIT
- MutationObserver + network quiet heuristic for consistent "done" detection
- 10s timeout penalty for broken renders (prevents silent failures)

## License

MIT — same as autoresearch.
