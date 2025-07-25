# End-to-End Testing with Playwright

This directory contains end-to-end tests for the Tlon web app using Playwright. The testing setup includes a custom orchestration system called **Rube** that manages fake Urbit ships for comprehensive testing scenarios.

## Quick Reference

-   Full suite: `pnpm e2e` (first run downloads ships, ~15 min; automatically nukes ship state)
-   Full suite with explicit extraction: `pnpm e2e:force` (forces complete re-extraction of ships instead of just nuking state)
-   Development: `pnpm e2e:ui` (interactive debugging)
-   Single test: `pnpm e2e:test filename.spec.ts` (automatic ship management)
-   Single test (manual): `npx playwright test filename.spec.ts` (requires running ships)
-   View results: `npx playwright show-report`
-   If you have an issue with a run, try it again with `force`.

## Overview

Our e2e testing infrastructure provides:

-   Automated Urbit ship management and setup
-   Cross-ship communication testing
-   Comprehensive UI interaction testing
-   Authentication and session management
-   Parallel test execution capabilities (not yet implemented)

## Architecture

### Core Components

1. **Rube Orchestration System** (`../rube/index.ts`)

    - Downloads and manages Urbit ships
    - Handles ship booting and updating to the latest backend code
    - Manages development server (vite) instances
    - Coordinates test environment setup

2. **Ship Manifest** (`shipManifest.json`)

    - Defines available test ships (zod, bus, and ten for now)
    - Contains ship URLs, ports, and authentication codes
    - Maps ship instances to web application URLs

3. **Authentication Setup** (`auth.setup.ts`)

    - Handles login for each test ship
    - Stores authentication state for reuse
    - Runs before test execution

4. **Test Helpers** (`helpers.ts`)
    - Reusable functions for common UI interactions
    - Group management utilities
    - Message and channel operations
    - Navigation and verification helpers

## Available Test Ships

The testing environment uses three pre-configured Urbit ships:

| Ship | Web URL               | HTTP Port | Auth File        | Purpose                                                                       |
| ---- | --------------------- | --------- | ---------------- | ----------------------------------------------------------------------------- |
| ~zod | http://localhost:3000 | 35453     | `.auth/zod.json` | Primary test ship                                                             |
| ~bus | http://localhost:3001 | 36963     | `.auth/bus.json` | Secondary ship for protocol mismatch tests (purposefully not kept up to date) |
| ~ten | http://localhost:3002 | 38473     | `.auth/ten.json` | Third ship for cross-ship testing                                             |

## Test Categories

### Functional Tests

-   **Chat Functionality** (`chat-functionality.spec.ts`) - Message sending, reactions, threads
-   **Direct Messages** (`direct-message.spec.ts`) - DM creation and management
-   **Thread Functionality** (`thread-functionality.spec.ts`) - Thread creation and replies
-   **Notebook Functionality** (`notebook-functionality.spec.ts`) - Long-form content creation
-   **Gallery Functionality** (`gallery-functionality.spec.ts`) - Media sharing and galleries

### Group Management

-   **Group Lifecycle** (`group-lifecycle.spec.ts`) - Group creation and deletion
-   **Group Customization** (`group-customization.spec.ts`) - Branding and appearance
-   **Group Info & Settings** (`group-info-settings.spec.ts`) - Configuration management
-   **Roles Management** (`roles-management.spec.ts`) - Permission and role assignment

### Cross-Ship Testing

-   **Group Cross-Ship Visibility** (`group-cross-ship-visibility.spec.ts`) - Multi-ship interactions
-   **Direct Message Mismatch** (`direct-message-mismatch.spec.ts`) - Error handling between ships
-   **Group Protocol Mismatch** (`group-protocol-mismatch.spec.ts`) - Version compatibility testing

### System Tests

-   **App Settings** (`app-settings.spec.ts`) - Application configuration
-   **Profile Functionality** (`profile-functionality.spec.ts`) - User profile management

## Running Tests

### Prerequisites

-   Node.js and pnpm installed
-   Sufficient disk space for ship downloads (~500MB per ship)
-   Available ports: 3000-3002, 35453, 36963, 38473

### Basic Commands

```bash
# Run all tests with full setup
pnpm e2e

# Run a single test with automatic ship management
pnpm e2e:test chat-functionality.spec.ts

# Run a single test in debug mode
pnpm e2e:test --debug chat-functionality.spec.ts

# Run a single test with multiple flags
pnpm e2e:test --headed --debug chat-functionality.spec.ts

# Run tests with playwright debug UI (full test suite)
pnpm e2e:debug

# Open Playwright UI for interactive testing
pnpm e2e:ui

# Run tests in headed mode (visible browser)
pnpm e2e:headed

# Generate test code using Playwright codegen
pnpm e2e:codegen
```

### Advanced Usage

```bash
# Run specific test file (requires manual ship setup)
npx playwright test chat-functionality.spec.ts
# Note: you must have all three test ships running on your machine in order to run any tests, and you cannot have any vite servers running

# Run specific test file with automatic ship management (recommended for development)
pnpm e2e:test chat-functionality.spec.ts

# Force re-extraction of all ships (useful for clean slate testing)
pnpm e2e:force

# Force re-extraction with single test
pnpm e2e:test:force chat-functionality.spec.ts

# Run tests matching pattern
npx playwright test --grep "group"

# Serve a playwright test report that you downloaded from github:
npx playwright show-report /path/to/the-report-dir
```

## Test Structure

### Typical Test File Structure

```typescript
import { expect, test } from '@playwright/test';

import * as helpers from './helpers';
import shipManifest from './shipManifest.json';

// Use authentication state for specific ship
test.use({ storageState: shipManifest['~zod'].authFile });

test('test description', async ({ page }) => {
    // Navigate to app
    await page.goto(`${shipManifest['~zod'].webUrl}/apps/groups/`);

    // Test-specific logic using helpers
    await helpers.createGroup(page);
    await helpers.sendMessage(page, 'Hello world');

    // Assertions
    await expect(page.getByText('Hello world')).toBeVisible();

    // Cleanup
    await helpers.deleteGroup(page);
});
```

### Helper Functions

The `helpers.ts` file provides numerous utility functions:

-   **Navigation**: `navigateBack()`, `clickThroughWelcome()`
-   **Group Management**: `createGroup()`, `deleteGroup()`, `openGroupSettings()`
-   **Messaging**: `sendMessage()`, `reactToMessage()`, `startThread()`
-   **Channel Operations**: `createChannel()`, `editChannel()`, `deleteChannel()`
-   **User Management**: `createRole()`, `assignRoleToMember()`
-   **Form Interactions**: `fillFormField()`
-   **Verification**: `verifyElementCount()`, `verifyMessagePreview()`

## Configuration

### Playwright Configuration (`../playwright.config.ts`)

-   **Timeout**: 60 seconds per test
-   **Retries**: 2 attempts on failure
-   **Workers**: 1 (to avoid conflicts between ships)
-   **Browser**: Chromium (Firefox/Safari commented out)
-   **Traces**: Retained on failure for debugging
-   **Screenshots/Videos**: Captured on failure

### Environment Variables

-   `SHIP_NAME`: Target specific ship for testing (zod, bus, ten)
-   `DEBUG_PLAYWRIGHT`: Enable debug output
-   `CI`: Enables CI-specific configurations
-   `FORCE_EXTRACTION`: Set to 'true' to bypass ship extraction checks and force re-extraction of all ships

## Development Workflow

### Running Individual Tests

For development convenience, use the automated single-test runner:

```bash
# This will automatically:
# 1. Boot all three ships (zod, bus, ten) without running tests
# 2. Start the web servers
# 3. Wait for everything to be ready
# 4. Run your specific test only
# 5. Clean up all processes when done
pnpm e2e:test notebook-functionality.spec.ts

# For debugging individual tests:
pnpm e2e:test --debug notebook-functionality.spec.ts
pnpm e2e:test --headed notebook-functionality.spec.ts
pnpm e2e:test --ui notebook-functionality.spec.ts
```

The script (located at `rube/run-single-test.ts`) uses a modified version of rube that stops before running the full test suite, then executes only your specific test. This handles all the orchestration for you, so you don't need to manually start ships or remember to clean up afterwards. This is especially useful when iterating on a single test during development.

### Adding New Tests

1. Create new `.spec.ts` file in the `e2e` directory
2. Import required helpers and ship manifest
3. Use appropriate authentication state
4. Follow established patterns for navigation and cleanup
5. Add reusable functions to `helpers.ts` if needed

### Debugging Tests

1. Use `pnpm e2e:debug` for console output
2. Run `pnpm e2e:ui` for interactive debugging
3. Use `pnpm e2e:headed` to see browser actions
4. Check generated traces, screenshots, and videos in `playwright-report/` (normally opened in your browser automatically if tests fail, can be opened by running `npx playwright show-report`)

### Ship Management

The Rube system automatically:

-   Downloads ship images from bootstrap.urbit.org
-   Extracts and configures ship instances
-   Boots ships with correct ports and settings
-   Mounts and commits desk changes
-   Nukes ship state before each run to ensure clean testing environment
-   Manages authentication and readiness checks

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 3000-3002, 35453, 36963, 38473 are available
2. **Ship download failures**: Check internet connection and bootstrap.urbit.org availability
3. **Authentication failures**: Delete `.auth/` directory and re-run tests
4. **Timeout errors**: Increase timeout in configuration or check ship readiness
5. **Corrupted ship state**: Ship state is automatically nuked before each run. If issues persist, use `FORCE_EXTRACTION=true` to force complete re-extraction of all ships

### Logs and Debugging

-   Playwright traces: `test-results/`
-   Ship logs: Check rube output for Urbit ship status
-   Browser console: Accessible through debug mode, also accessible through Playwright traces
-   Network requests: Captured in Playwright traces, also accessible through debug mode

## Maintenance

### Updating Ship Images

Ship images are periodically updated. To use newer versions:

1. Update URLs in `shipManifest.json`
2. Delete existing ship files in `rube/` directory
3. Re-run tests to download fresh images

### Test Data Cleanup

Tests are designed to be self-cleaning, and ship state is automatically reset before each test run:

-   Remove test groups and channels (handled by test cleanup helpers)
-   Ship state is automatically nuked before each **rube** run

## Contributing

When adding new test scenarios:

1. Follow existing naming conventions
2. Use helper functions for common operations
3. Ensure proper cleanup in test teardown
4. Add new helpers for reusable patterns
5. Update this documentation for significant changes

## Test Isolation

-   Each test should be independent and self-cleaning
-   Ship state is automatically nuked (reset) before each **rube** run, ensuring clean state for every test suite execution
-   When using `FORCE_EXTRACTION=true`, ships are fully re-extracted instead of just having their state nuked
-   Tests use cleanup helpers to remove created groups/channels
-   Authentication state is reused across tests for performance

## Continuous Integration

### GitHub Actions Workflow

-   Tests run on every pull request via `.github/workflows/ci.yml`
-   Playwright browsers are cached, but ship piers are **not cached** (due to current issues)
-   Each CI run downloads fresh ship images (~1.5GB total)
-   Full CI run including setup takes approximately 7-10 minutes

### CI-Specific Behavior

-   `CI=true` environment variable enables CI-specific configurations
-   Ships download fresh on each run, and ship state is automatically nuked before each test execution
-   Playwright runs in headless mode only
-   HTML reports are uploaded as GitHub artifacts with 30-day retention

### Accessing CI Test Results

```bash
# Download the playwright-report artifact from GitHub Actions
# Then serve it locally:
npx playwright show-report /path/to/downloaded/playwright-report
```

## Performance Considerations

-   Full test suite takes approximately 7-10 minutes
-   Each ship requires ~500MB disk space + memory for Urbit process
-   Tests run sequentially to avoid state conflicts
-   Consider running subset of tests (or a single test) during development

### Optimized Ship and Desk Management

The testing infrastructure now includes optimizations to reduce setup time:

-   **Ship Extraction**: Ships are only re-extracted if their directory doesn't exist or is invalid
-   **Desk Diffing**: Backend code (`/desk` directory) is only copied and committed if there are actual changes
-   **Selective Updates**: Only ships with desk changes go through the mount/commit process

This significantly reduces setup time when running individual tests repeatedly during development, as unchanged ships skip the expensive extraction and commit operations.
