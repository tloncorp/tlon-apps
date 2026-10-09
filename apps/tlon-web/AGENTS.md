# AGENTS.md — tlon-web and its E2E suite

Web E2E tests are Playwright, live in `e2e/`, and run against real Urbit ships
started by the rube scripts in `rube/`. Run them from this directory, by
filename only:

```bash
cd apps/tlon-web && pnpm e2e:test channel-details.spec.ts   # not e2e/channel-details.spec.ts
```

**Web E2E tests always render the desktop navigation.** Test IDs for them go in
`packages/app/navigation/desktop/`, not in the mobile screens under
`packages/app/features/` (see `packages/app/AGENTS.md`). Web builds render
`testID` as `data-testid`.

## Playwright MCP Server Authentication

When using Claude Code with the Playwright MCP server for e2e testing:

-   **Manual authentication required**: All ships may need manual authentication with MCP server. If you see a login screen, you need to log into the ship using the authentication codes below.
-   **No persistent auth state**: MCP server does not maintain authentication across Claude Code instances
-   **Authentication codes for manual entry**:
    -   ~zod: `lidlut-tabwed-pillex-ridrup`
    -   ~ten: `lapseg-nolmel-riswen-hopryc`
    -   ~bus: `riddec-bicrym-ridlev-pocsef`
    -   ~bud: `lathus-worsem-bortem-padmel`
-   **Process**: When you navigate to any ship URL, you may see a login page - enter the auth code for that ship
-   **Environment setup**: Use `pnpm e2e:playwright-dev` to start ships + web servers for MCP testing
-   **IMPORTANT**: Always stop the `pnpm e2e:playwright-dev` script before running `pnpm e2e:test` or other e2e commands to avoid port conflicts
-   **MCP Server Debugging Workflow (DEFAULT - RECOMMENDED):**

    1. **Run `./start-playwright-dev.sh` to start environment in background** - this will start the dev environment and return when ready
    2. Use Playwright MCP server tools to navigate and debug while environment runs in background
    3. **Stop the environment when done** using one of:
        - `kill [PID]` - Graceful shutdown (PID shown in script output)
        - `./stop-playwright-dev.sh` - Comprehensive cleanup that ensures all processes are stopped
        - `./stop-playwright-dev.sh --clean-logs` - Also removes log files

    **Alternative (Manual Terminal Management):**

    1. **Ask user to run `pnpm e2e:playwright-dev` in a separate terminal** - this script runs continuously and must stay running
    2. **Wait for user confirmation** that ships and web servers are ready (user will see "Environment ready for Playwright MCP development!")
    3. Use Playwright MCP server tools to navigate and debug while the script continues running
    4. Ask user to stop the script (Ctrl+C) before running actual tests with `pnpm e2e:test <filename>`

-   **Test Development**: Examine existing e2e test files in `apps/tlon-web/e2e/` to understand test structure, patterns, and helper function usage before creating new tests
-   **Cross-ship testing with MCP**: For testing interactions between ships, simply open new browser tabs and navigate to different ship URLs:
    -   ~zod: `http://localhost:3000/apps/groups/`
    -   ~ten: `http://localhost:3002/apps/groups/`
    -   ~bus: `http://localhost:3001/apps/groups/`
    -   ~bud: `http://localhost:3004/apps/groups/`
    -   Authenticate each ship manually when prompted, then switch between tabs during testing

## E2E Test Patterns and Gotchas

**DM vs Group Channel Differences:**

-   **DMs and DM threads**: No "Chat Post" text appears when quoting messages - quoted content appears directly in input as `"> original message"`
-   **Group channels**: "Chat Post" text appears in quote interface
-   **Helper function usage**: Always pass `isDM=true` parameter to `quoteReply()` and `threadQuoteReply()` when testing DM contexts

**Helper Function Parameters:**

-   Many helper functions in `helpers.ts` have optional `isDM` parameters that change behavior for Direct Message contexts
-   Check function signatures before use - DM behavior often differs from group channel behavior
-   Example: `helpers.threadQuoteReply(page, originalMessage, replyText, true)` for DM threads

**Message Editing Best Practices:**

-   **CRITICAL**: Thread messages can only be edited from within the thread view, NOT from the main conversation view
-   **DM thread editing complexity**: Message editing in DM threads may require complex navigation state management
-   **Avoid**: Trying to edit thread messages from main conversation view - "Edit message" option doesn't exist there

**Test Infrastructure:**

-   Use Playwright MCP server for interactive debugging to understand UI behavior before writing assertions
-   **Test failure debugging**: View screenshots and traces in `apps/tlon-web/test-results/` directory

**Navigation Stability in DM Tests:**

-   DM thread context is more fragile than group channels - tests can unexpectedly navigate back to Home
-   Always verify thread context before performing actions: `await expect(page.getByText('N replies')).toBeVisible()`
-   Add navigation recovery logic: check for Home page and navigate back to DM if needed
-   Use timeouts after navigation actions to allow UI to stabilize before next assertions

**Message Text Best Practices:**

-   **Use unique, distinct message text** - avoid similar messages that can cause partial matching issues
-   **Bad**: "Hello ~zod! Let's test" and "Hello ~ten! Let's test" (too similar)
-   **Good**: "Zod message: unique content" and "Ten message: different content" (clearly distinct)
-   **Helper function issue**: `longPressMessage()` uses text search that may match wrong message if text is similar

**Playwright Selector Best Practices:**

-   **Use exact text matching** when possible: `getByText('Reply', { exact: true })` instead of `getByText('Reply')`
-   **Avoid partial text matches** that can match multiple elements (e.g., "Reply" matches both "Reply" and "1 reply")
-   **Strict mode violations**: Playwright will error if a selector matches multiple elements - use more specific selectors

**CRITICAL Test Debugging Philosophy:**

-   **ALWAYS root cause test failures** - never write workarounds, defensive programming, or conditional logic to mask underlying issues
-   **Fix the actual problem** - if a test is flaky, find why the application state is inconsistent and fix that
-   **Avoid try/catch blocks and fallback logic** - these hide real bugs and make tests unreliable
-   **Test instability indicates real application issues** - treat flaky tests as bugs in the application, not test problems to work around

**Test Isolation and Cleanup:**

-   **Cleanup belongs in test-fixtures.ts** - modify `performCleanup()` function in test-fixtures.ts, not individual tests
-   **Complete state cleanup required** - ALL participating ships must clean up (e.g., both ships must `leaveDM`, not just one)
-   **Test pollution symptoms** - if second test fails but first passes in isolation, suspect incomplete cleanup in test-fixtures.ts
-   **DM state persistence** - DM conversations persist across tests and affect subsequent test behavior
-   **Automatic cleanup** - test-fixtures.ts runs `performCleanup()` both before and after each test

**Deterministic Waits vs Arbitrary Timeouts:**

-   **Replace `waitForTimeout(N)` with `expect().toBeVisible({ timeout: N })`** - wait for actual conditions, not arbitrary time
-   **Cross-ship sync detection** - use UI element visibility to detect when sync is complete, not fixed delays
-   **Timeout values** - use longer timeouts (10-15s) for cross-ship operations, shorter (3-5s) for local UI changes

**DM Thread Context Management:**

-   **Thread indicators only visible in main DM view** - elements exist but are "hidden" when inside thread context
-   **Explicit navigation required** - always `navigateBack()` to main DM view before checking thread indicators
-   **Context verification** - verify you're in the expected view (thread vs main DM) before performing actions
-   **Thread vs DM view state** - tests can unexpectedly be in wrong context, causing element visibility issues

**Test Design and Duplication:**

-   **Avoid duplicate e2e test functionality** - consolidate similar test scenarios into comprehensive tests rather than creating multiple redundant tests
-   **Test consolidation** - if multiple tests cover similar functionality, merge them into a single comprehensive test that covers all scenarios
-   **Focus on unique test scenarios** - each test should cover distinct functionality or edge cases, not repeat the same operations

**Contact Relationship Management:**

-   **Personal invite links create contacts automatically** - visiting `inviteToken=${token}` URLs adds the token owner as a contact
-   **Contact relationships are asymmetric** - ~ten having ~zod as contact doesn't mean ~zod has ~ten
-   **Always clean up contacts** - any test creating contacts must remove them: `await page.getByText('Remove contact').click()`
-   **Check both ships** - when debugging contact issues, check both sides of the relationship

**Test Pollution Debugging Strategy:**

1. **Run test in isolation first** - `pnpm e2e:test failing-test.spec.ts`
2. **If it passes, find the polluting test** - run subsets of tests alphabetically before the failing test
3. **Check for missing cleanup** - look for tests that create contacts, profiles, or other persistent state
4. **Common pollution sources**:
    - `invite-service.spec.ts` - creates contacts via invite links
    - Tests with profile editing - may leave custom nicknames
    - Tests creating DMs - both ships must clean up
    - Tests with group invites - may leave pending invitations

**E2E Helper Function Design Principles:**

-   **Single responsibility** - Each helper function should do one thing well (e.g., `longPressMessage` only opens the action menu, doesn't verify what's in it)
-   **Use test IDs over text content** - Rely on semantic test IDs like `data-testid="ChatMessageActions"` instead of checking for specific menu text
-   **Avoid context parameters** - Don't require callers to specify context (like 'chat', 'gallery', 'dm') unless absolutely necessary
-   **Keep helpers simple** - A 25-line helper is better than a 100-line helper with complex conditional logic
-   **Let tests handle variations** - The helper opens the menu; the test decides which action to click based on what it expects
-   **Example of good design**: `longPressMessage()` uses `getByTestId('ChatMessageActions')` universally instead of checking for context-specific menu items

## E2E Test Infrastructure

**Understanding the rube script:**

-   `pnpm rube` or `pnpm e2e` runs the core test infrastructure
-   Rube performs critical setup: nukes ship state, sets ~mug as reel provider, configures S3 storage (if env vars set), applies desk updates
-   Ships are considered ready when rube outputs "SHIP_SETUP_COMPLETE" signal
-   Ship readiness can be verified via HTTP: `http://localhost:{port}/~/scry/hood/kiln/pikes.json`
-   Default timeout is 30 seconds (can be extended with FORCE_EXTRACTION=true environment variable)

**S3 Storage Configuration for E2E Tests:**

-   Optional: Image upload tests will be skipped if not configured
-   Set these environment variables to enable image uploads in e2e tests:
    -   `E2E_S3_ENDPOINT` - S3 endpoint URL (e.g., `https://s3.amazonaws.com`)
    -   `E2E_S3_ACCESS_KEY_ID` - AWS access key ID
    -   `E2E_S3_SECRET_ACCESS_KEY` - AWS secret access key
    -   `E2E_S3_BUCKET_NAME` - S3 bucket name for test uploads
    -   `E2E_S3_REGION` - AWS region (optional, defaults to `us-east-1`)
-   Storage is configured automatically during ship setup if environment variables are present
-   Each test ship gets the same S3 configuration

**Pier Archiving and Updates:**

-   Test piers are pre-configured Urbit ships stored as archives in GCS
-   Archives are referenced in `apps/tlon-web/e2e/shipManifest.json`
-   To update pier archives: `./apps/tlon-web/rube/archive-piers.sh`
-   To verify archives: `./apps/tlon-web/rube/verify-archives.sh`
-   Two ships are hand-built and excluded from the routine archive run:
    -   ~bus is intentionally kept outdated for protocol mismatch testing
    -   ~bud is the pinned N-1 desk pier (`deskVersion` in the manifest, kept
        equal to `MIN_GROUPS_VERSION`). Rebuild it with
        `./apps/tlon-web/rube/build-n1-pier.sh` whenever that constant moves —
        see `docs/tlon-apps/desk-compatibility.md`.
-   Archive naming convention: `rube-{ship}{version}.tgz` (e.g., `rube-zod15.tgz`)

**Important Scripts:**

-   `./start-playwright-dev.sh` - Starts ships in background, returns when ready
-   `./stop-playwright-dev.sh` - Comprehensive cleanup of all e2e processes
-   `./apps/tlon-web/rube-cleanup.sh` - Emergency cleanup when processes are stuck
-   `pnpm e2e:playwright-dev` - Starts ships and web servers (runs indefinitely)
-   `pnpm e2e:test <file1> [file2...]` - Runs one or more test files with ship setup (useful for testing interactions)
-   `pnpm e2e` - Full test suite (now properly handles Ctrl+C interruption)

**Process Cleanup Improvements:**

-   **Automatic cleanup**: Ctrl+C now properly cleans up all processes including Urbit serf sub-processes
-   **Emergency cleanup**: Run `./apps/tlon-web/rube-cleanup.sh` if processes get stuck
-   **Pattern-based killing**: Infrastructure uses pattern matching to find and kill all related processes

**Common E2E Testing Pitfalls:**

-   **Ship readiness**: Checking for `.http.ports` files doesn't mean ships are ready - wait for SHIP_SETUP_COMPLETE
-   **Desk updates**: Applying desk updates can take 5-10 minutes, default timeouts may be too short
-   **Process cleanup**: Now handled automatically, but use `rube-cleanup.sh` for emergency recovery
-   **Manifest changes**: Always backup `shipManifest.json` before modifying - it's critical for e2e tests

**GCP Integration for E2E Archives:**

-   E2E test piers are stored in GCS: `gs://bootstrap.urbit.org/`
-   GCP project: `tlon-groups-mobile` (hardcoded for security)
-   Archives are publicly readable once uploaded
-   Authentication required: `gcloud auth login`
-   Verify access: `gsutil ls gs://bootstrap.urbit.org/`

**Investigating CI E2E Failures:**

-   The parallel E2E CI job runs tests in Docker containers across 4 shards. The main job log only shows container status polling and a summary (e.g., "Total tests: 71, Total failures: 1") — it does NOT contain the specific test failure details.
-   To find the actual failing test, download the `e2e-test-results` artifact: `gh run download <run-id> --name e2e-test-results --dir /tmp/e2e-results`
-   The artifact contains:
    -   `junit-merged.xml` — JUnit XML with all test results. Search for `<failure` tags to find the failing test name, file, and error message.
    -   `merged-report/` — Playwright HTML report (view with `npx playwright show-report /tmp/e2e-results/merged-report`)
    -   `logs/shard-{1,2,3,4}.log` — Per-shard container logs with detailed Playwright output
-   Common false positives: Cross-ship sync timeouts (e.g., waiting for reply counts to sync between ships) are a frequent source of flaky failures unrelated to code changes

**Test State Persistence Issues:**

-   Ship state is nuked between full test runs, but NOT between individual tests in the same run
-   Contact relationships persist across tests within a run
-   Profile modifications (nicknames, status, bio) persist
-   Some state changes are asymmetric and require cleanup on specific ships
-   Use `test-fixtures.ts` performCleanup() for systematic cleanup


## Code Review Rules

-   A flaky or failing test is treated as an application bug: flag fixes that
    add retries, `try/catch`, conditional fallbacks or `waitForTimeout` to make
    a test pass, and ask for the root cause instead.
-   New persistent state a test creates (contacts, DMs, profile fields, group
    invites) needs cleanup in `performCleanup()` in `e2e/test-fixtures.ts`, on
    every participating ship, not in the test body.
-   Do not flag long timeouts (10–15s) on cross-ship assertions; sync between
    ships is slow by nature.
