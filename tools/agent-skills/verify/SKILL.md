---
name: verify
description: Verify tlon-apps web UI changes end-to-end with a single local ship + vite dev server (lighter than the full playwright-dev rig)
---

# Verify tlon-apps UI changes (single-ship recipe)

The full `./start-playwright-dev.sh` rig boots 2+ ships (2GB loom each) and
can get OOM-killed on low-memory machines mid desk-commit ("Ships process
exited unexpectedly with code null"). For UI verification a single ship +
one vite server is enough and much lighter.

**Capabilities assumed** (this is a recipe, not tied to one agent — any agent
with these can follow it): a **shell** (urbit binary, `pnpm`, `curl`, `lsof`),
**filesystem** access to the repo, and a **browser-automation tool** that can
navigate, type/fill inputs, click by selector, evaluate JS in the page, and
screenshot. Where noted, use your tool's own verbs for those actions.

## Gotchas (hit these before, save the debugging)

- **asdf**: repo `.tool-versions` pins nodejs 20.11.0 which may not be
  installed. Prefix commands with `ASDF_NODEJS_VERSION=25.9.0` (or whatever
  `asdf list nodejs` shows) or the pnpm shim fails with "No version is set
  for command pnpm".
- **peru**: rube's desk assembly needs `peru` on PATH (`brew install pipx &&
  pipx install peru`). Without it rube dies at "Vendoring desk dependencies".
- **Process sandbox**: launch the ship and web server as real, long-lived
  detached processes. Some agent execution sandboxes kill detached/background
  processes — if yours does, run these steps with the sandbox disabled.

## Recipe

1. Piers + urbit binary live in `apps/tlon-web/rube/dist/` after any rube
   run (zod/, ten/, urbit_extracted/urbit). If missing, let
   `./start-playwright-dev.sh` run once to download/extract, then kill it.
2. Boot the **zod** ship (http port 35453 per `apps/tlon-web/e2e/shipManifest.json`).
   **First make sure zod's own port/pier isn't already live** — deleting a live
   `.vere.lock` and booting a second Vere on the same pier corrupts/wedges it.
   Gate on **zod specifically** — its port `:35453` **or** a live process on the
   `zod/zod` pier. Check both, because a zod daemon that is still booting has
   created `.vere.lock` but hasn't bound `:35453` yet; a port-only check would then
   delete a live lock and start a second Vere on the same pier (the exact
   corruption this guards against). The pier-path match keeps it zod-specific, so
   another rube ship like `~ten` (`ten/ten`, `:38473`) is correctly ignored and
   doesn't make you skip booting zod. The `-d` flag runs Vere as a detached
   daemon, so the boot returns and you can proceed:
   ```
   cd apps/tlon-web
   if lsof -ti :35453 >/dev/null 2>&1 || pgrep -f 'rube/dist/zod/zod' >/dev/null; then
     echo "zod already live (port :35453 or zod/zod pier process) — reuse it; do NOT delete the lock or boot again."
   else
     rm -f rube/dist/zod/zod/.vere.lock
     ./rube/dist/urbit_extracted/urbit rube/dist/zod/zod -d --http-port 35453   # -d = daemon (detached)
   fi
   ```
3. Start the web server. It runs in the **foreground and blocks**, so launch it as
   a long-lived background/detached process (your agent's background-run
   mechanism, a separate terminal/session, or append `&`) — otherwise the recipe
   hangs here and never reaches the browser step:
   ```
   cd apps/tlon-web
   SHIP_URL=http://localhost:35453 VITE_DISABLE_SPLASH_MODAL=true pnpm dev-no-ssl --port 3000 &
   ```
4. Browse `http://localhost:3000/apps/groups/`, log in with zod code
   `lidlut-tabwed-pillex-ridrup`. Rube nukes ship state, so create a quick
   group via the + button to get a chat channel.
5. Vite serves `packages/app` etc. from source (workspace `main: index.ts`),
   so edits hot-reload; confirm served code with
   `curl -s "http://localhost:3000/apps/groups/@fs/<abs-path-to-file>" | grep <new-identifier>`.

## Browser-driving notes

- Synthesized `key` events (cmd+a, Backspace, Return) do NOT reach the RN-web
  textarea. Use your browser tool's **type**/**fill** action instead. To
  "select-all + type over", set the value in one fill/input action (same as a
  real replace) rather than key-by-key. To send, click
  `[data-testid="MessageInputSendButton"]`.
- The TanStack devtools floating toggle overlaps the send button bottom-right;
  hide it first: `document.querySelector('button[aria-label="Open Tanstack
  query devtools"]').style.display='none'`.
- Screenshot coords are viewport × (screenshot_width / viewport_width) —
  get element rects via JS and scale.
- Link-preview metadata fetches go browser → ship metagrab → target URL, so a
  local `node` HTTP server with a `setTimeout` response works as a slow/
  controllable metadata target (ship can reach localhost).

## Teardown

`lsof -ti:3000 | xargs kill -9; lsof -ti:35453 | xargs kill -9;
pkill -f "rube/dist/urbit_extracted"`
