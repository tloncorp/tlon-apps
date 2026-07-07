# TLON-6042 Internal Bot Rollout Path

Minimum path to get the `%notes` CLI functionality onto internal test bots:

1. Confirm internal bot ships have the merged `%notes` backend installed.
   - This is assumed satisfied for this rollout.

2. Patch OpenClaw so the `tlon` tool can invoke the new notes command family.
   - Add `notes` to the `ALLOWED_TLON_COMMANDS` set in `packages/openclaw/index.ts`.
   - Keep `notebook` allowed for now so old notebook invocations reach the tlon skill and receive the skill's intentional deprecation/removal guidance instead of OpenClaw's generic unknown-subcommand error.
   - Add/update `packages/openclaw/src/tlon-tool-guard.test.ts` coverage for `notes`.

3. Update tlonbot prompts so agents stop reaching for notebook/diary commands.
   - Replace prompt references to `diary/` channel format and `tlon notebook ...`.
   - Add a concise `%notes` quick-reference entry using `tlon notes ...`.

4. Publish package dependencies needed by hosted bot deployment.
   - Hosted bot deployment resolves `packages/openclaw` workspace dependencies from npm, not from the `develop` checkout.
   - Publish bumped `@tloncorp/api` and `@tloncorp/tlon-skill` versions before restarting bots.
   - Current published versions match the local package versions, so version bumps are required before publish.

5. Land the OpenClaw patch on `develop`.
   - Internal monorepo deployments use the `packages/openclaw` source from `develop`.
   - A `packages/openclaw/**` change also triggers the tlonbot smoke dispatch path after merge.

6. Restart internal bot ships.
   - Use the `Restart Bot Ships` workflow with `mode=internal` after the relevant npm publishes are available.
   - If the OpenClaw source patch lands before the npm publishes, restart again after publish.

7. Verify on an internal bot.
   - Check the installed tlon skill version.
   - Run `tlon notes status` and `tlon notes list`.
   - Run a legacy `tlon notebook ...` invocation and confirm it returns the skill-level notebook removal guidance.

Out of scope for this minimum path:

- Updating OpenClaw channel target parsing, monitoring, and message routing to treat notes channels as first-class channel targets. That is separate from exposing the `tlon notes` CLI family to bots.
