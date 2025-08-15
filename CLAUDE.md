# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Building

-   `pnpm run build:all` - Build all packages and applications
-   `pnpm run build:packages` - Build shared packages only (shared, ui, editor)
-   `pnpm run build:web` - Build web application
-   `pnpm run build:mobile` - Build mobile application
-   `pnpm run build:desktop` - Build desktop application

### Development

-   `pnpm run dev:web` - Start web development server
-   `pnpm run dev:ios` - Start iOS development with live reload
-   `pnpm run dev:android` - Start Android development with live reload
-   `pnpm run dev:desktop` - Start desktop development

### Testing

-   `pnpm run test` - Run all tests with updates
-   `pnpm run test:ci` - Run all tests in CI mode
-   `pnpm run e2e` - Run end-to-end tests (web)

### Linting

-   `pnpm run lint:all` - Run linting across all packages
-   `pnpm lint:fix` - Fix linting issues (per package)
-   `pnpm lint:format` - Format code with prettier (per package)

### Installing Dependencies

-   `pnpm install` - Install all dependencies
-   `pnpm run deps` - Install dependencies including iOS pods

## Architecture Overview

This is a monorepo for Tlon Messenger containing multiple applications and shared packages:

### Applications

-   **tlon-web**: Web application built with React, TypeScript, and Vite
-   **tlon-mobile**: React Native application for iOS and Android using Expo
-   **tlon-desktop**: Electron desktop application wrapping the web app

### Shared Packages

-   **packages/shared**: Core business logic, API clients, database schema, and state management
-   **packages/ui**: Shared UI components using Tamagui
-   **packages/app**: App-specific components and navigation
-   **packages/editor**: Rich text editor components

### Backend

-   **desk/**: Urbit backend applications written in Hoon
    -   Core agents: %groups, %channels, %chat, %contacts, %activity, %profile

## Key Technologies

-   **Frontend**: React, TypeScript, React Native, Expo, Electron
-   **UI**: Tamagui, Tailwind CSS
-   **State Management**: Zustand, React Query
-   **Database**: SQLite (web: SQLocal, mobile: op-sqlite, desktop: better-sqlite3)
-   **Backend**: Urbit (Hoon)
-   **Build**: Vite, Metro, pnpm workspaces

## Development Workflow

1. Install dependencies: `pnpm install`
2. Build packages: `pnpm run build:packages`
3. Start development server for your target platform
4. Use `pnpm run cosmos` for component development

### Mobile Development

-   Requires iOS/Android development environment
-   Uses Expo for development builds
-   Run `pnpm run deps:ios` for iOS pod installation

### Web Development

-   Requires `.env.local` file in `apps/tlon-web` with `VITE_SHIP_URL`
-   Supports hot reloading via Vite

### Desktop Development

-   Builds on top of web application
-   Uses Electron for native desktop features

### Shell Script Compatibility

When writing or modifying bash scripts, ensure compatibility with both macOS and Linux:
-   Use `#!/bin/bash` shebang (not `#!/bin/sh`) for consistent behavior
-   Avoid bash-specific features that vary by version (e.g., associative arrays with `declare -A`)
-   Handle differences between BSD (macOS) and GNU (Linux) tools, especially `tar`, `sed`, `grep`
-   Test scripts on both macOS and Linux when possible
-   Use portable command options (e.g., `grep -E` instead of `egrep`)

## Testing

-   **Unit tests**: Vitest for shared packages, Jest for mobile
-   **E2E tests**: Playwright for web application
-   **UI tests**: React Cosmos for component testing

### Playwright MCP Server Authentication

When using Claude Code with the Playwright MCP server for e2e testing:

-   **Manual authentication required**: All ships may need manual authentication with MCP server. If you see a login screen, you need to log into the ship using the authentication codes below.
-   **No persistent auth state**: MCP server does not maintain authentication across Claude Code instances
-   **Authentication codes for manual entry**:
    -   ~zod: `lidlut-tabwed-pillex-ridrup`
    -   ~ten: `lapseg-nolmel-riswen-hopryc`
    -   ~bus: `riddec-bicrym-ridlev-pocsef`
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
    -   Authenticate each ship manually when prompted, then switch between tabs during testing

### E2E Test Patterns and Gotchas

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

**E2E Helper Function Design Principles:**

-   **Single responsibility** - Each helper function should do one thing well (e.g., `longPressMessage` only opens the action menu, doesn't verify what's in it)
-   **Use test IDs over text content** - Rely on semantic test IDs like `data-testid="ChatMessageActions"` instead of checking for specific menu text
-   **Avoid context parameters** - Don't require callers to specify context (like 'chat', 'gallery', 'dm') unless absolutely necessary
-   **Keep helpers simple** - A 25-line helper is better than a 100-line helper with complex conditional logic
-   **Let tests handle variations** - The helper opens the menu; the test decides which action to click based on what it expects
-   **Example of good design**: `longPressMessage()` uses `getByTestId('ChatMessageActions')` universally instead of checking for context-specific menu items

### E2E Test Infrastructure

**Understanding the rube script:**
-   `pnpm rube` or `pnpm e2e` runs the core test infrastructure
-   Rube performs critical setup: nukes ship state, sets ~mug as reel provider, applies desk updates
-   Ships are considered ready when rube outputs "SHIP_SETUP_COMPLETE" signal
-   Ship readiness can be verified via HTTP: `http://localhost:{port}/~/scry/hood/kiln/pikes.json`
-   Default timeout is 30 seconds (can be extended with FORCE_EXTRACTION=true environment variable)

**Pier Archiving and Updates:**
-   Test piers are pre-configured Urbit ships stored as archives in GCS
-   Archives are referenced in `apps/tlon-web/e2e/shipManifest.json`
-   To update pier archives: `./apps/tlon-web/rube/archive-piers.sh`
-   To verify archives: `./apps/tlon-web/rube/verify-archives.sh`
-   ~bus is intentionally kept outdated for protocol mismatch testing
-   Archive naming convention: `rube-{ship}{version}.tgz` (e.g., `rube-zod15.tgz`)

**Important Scripts:**
-   `./start-playwright-dev.sh` - Starts ships in background, returns when ready
-   `./stop-playwright-dev.sh` - Comprehensive cleanup of all e2e processes
-   `pnpm e2e:playwright-dev` - Starts ships and web servers (runs indefinitely)
-   `pnpm e2e:test <file>` - Runs a single test file with ship setup

**Common E2E Testing Pitfalls:**
-   **Ship readiness**: Checking for `.http.ports` files doesn't mean ships are ready - wait for SHIP_SETUP_COMPLETE
-   **Desk updates**: Applying desk updates can take 5-10 minutes, default timeouts may be too short
-   **Process cleanup**: Always ensure proper cleanup of Urbit ships and web servers (ports 3000-3003, 35453, 36963, 38473, 39983)
-   **Manifest changes**: Always backup `shipManifest.json` before modifying - it's critical for e2e tests

**GCP Integration for E2E Archives:**
-   E2E test piers are stored in GCS: `gs://bootstrap.urbit.org/`
-   GCP project: `tlon-groups-mobile` (hardcoded for security)
-   Archives are publicly readable once uploaded
-   Authentication required: `gcloud auth login`
-   Verify access: `gsutil ls gs://bootstrap.urbit.org/`

## Package Dependencies

The monorepo uses a dependency hierarchy:

-   Apps depend on packages (shared, ui, app, editor)
-   Packages can depend on each other (app → shared, ui → shared)
-   Shared package is the foundation with no internal dependencies

## Backend Integration

The frontend communicates with Urbit backend through:

-   HTTP API via `@urbit/http-api`
-   Server-sent events for real-time updates
-   Custom API layer in `packages/shared/src/api/`

## Database Schema

Uses Drizzle ORM with SQLite for local data storage:

-   Schema defined in `packages/shared/src/db/schema.ts`
-   Migrations in `packages/shared/src/db/migrations/`
-   Platform-specific database connections in `packages/shared/src/db/`
