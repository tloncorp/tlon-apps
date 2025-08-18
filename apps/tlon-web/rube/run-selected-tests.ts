#!/usr/bin/env node
import * as childProcess from 'child_process';
import * as fs from 'fs';
import fetch from 'node-fetch';
import * as path from 'path';

import { Ship } from './index';

// Parse command line arguments
const args = process.argv.slice(2);
const testFiles = args.filter((arg) => arg.endsWith('.spec.ts'));
const playwrightFlags = args.filter((arg) => !arg.endsWith('.spec.ts'));

if (testFiles.length === 0) {
  console.error('Usage: pnpm e2e:test [flags] <test-file.spec.ts> [test-file2.spec.ts ...]');
  console.error('Examples:');
  console.error('  # Single test file:');
  console.error('  pnpm e2e:test chat-functionality.spec.ts');
  console.error('  pnpm e2e:test --debug chat-functionality.spec.ts');
  console.error('  ');
  console.error('  # Multiple test files:');
  console.error('  pnpm e2e:test chat-functionality.spec.ts direct-message.spec.ts');
  console.error('  pnpm e2e:test --headed group-lifecycle.spec.ts group-customization.spec.ts');
  console.error('');
  console.error('Common flags: --debug, --headed, --ui, --trace=on');
  process.exit(1);
}

// Validate that all test files exist
// Note: __dirname will be rube/dist when compiled, so we need to go up two levels
const invalidFiles: string[] = [];
const validTestPaths: string[] = [];

for (const testFile of testFiles) {
  const testPath = path.join(__dirname, '../../e2e', testFile);
  if (!fs.existsSync(testPath)) {
    invalidFiles.push(testFile);
  } else {
    validTestPaths.push(testPath);
  }
}

if (invalidFiles.length > 0) {
  console.error(`❌ Test file(s) not found: ${invalidFiles.join(', ')}`);
  console.error('');
  console.error('Available test files:');
  try {
    const e2eDir = path.join(__dirname, '../../e2e');
    const availableFiles = fs
      .readdirSync(e2eDir)
      .filter((f) => f.endsWith('.spec.ts'));
    availableFiles.forEach((file) => console.error(`   - ${file}`));
  } catch {
    console.error('   (Could not list available files)');
  }
  process.exit(1);
}

let rubeProcess: childProcess.ChildProcess | null = null;
let isShuttingDown = false;
const pidFile = path.join(__dirname, '.run-selected-tests.pid');

// Handle cleanup on exit
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

function cleanup() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('\n🧹 Cleaning up...');

  if (rubeProcess && !rubeProcess.killed && rubeProcess.pid) {
    console.log('Killing rube process...');
    try {
      // Try graceful termination first
      rubeProcess.kill('SIGTERM');

      // Give it a moment to terminate gracefully
      const timeout = Date.now() + 1000;
      while (Date.now() < timeout) {
        try {
          process.kill(rubeProcess.pid, 0); // Check if still alive
        } catch {
          break; // Process is dead
        }
      }

      // Force kill if still running
      try {
        rubeProcess.kill('SIGKILL');
      } catch {}
    } catch (error) {
      console.log('Process already terminated');
    }
  }

  // CRITICAL: Use pattern-based killing to clean up all Urbit processes
  // This is necessary because Urbit spawns serf sub-processes that aren't tracked
  try {
    // Kill all Urbit processes matching our rube pattern
    console.log('Killing Urbit processes...');
    // Use a subshell to handle empty output gracefully on macOS
    const killUrbitCmd = `pids=$(ps aux | grep urbit | grep "rube/dist" | grep -v grep | awk '{print $2}'); [ -n "$pids" ] && echo "$pids" | xargs kill -9 2>/dev/null || true`;
    childProcess.execSync(killUrbitCmd, { stdio: 'ignore' });

    // Also kill any node processes running rube
    const killNodeRubeCmd = `pids=$(ps aux | grep "node.*rube/dist/index.js" | grep -v grep | awk '{print $2}'); [ -n "$pids" ] && echo "$pids" | xargs kill -9 2>/dev/null || true`;
    childProcess.execSync(killNodeRubeCmd, { stdio: 'ignore' });

    // Also kill any Vite dev server processes
    console.log('Killing Vite processes...');
    const killViteCmd = `pids=$(ps aux | grep "vite dev" | grep -v grep | awk '{print $2}'); [ -n "$pids" ] && echo "$pids" | xargs kill -9 2>/dev/null || true`;
    childProcess.execSync(killViteCmd, { stdio: 'ignore' });
  } catch (error) {
    // Only log if it's a real error, not just "no processes found"
    if (error.status !== 1) {
      console.log('Error during pattern-based cleanup:', error.message);
    }
  }

  // Additional cleanup - kill any remaining processes on our test ports
  const shipManifest = require('../../e2e/shipManifest.json');
  const ships = Object.values(shipManifest) as Ship[];
  const ports: string[] = [];

  // Collect all ports used by ships
  ships.forEach((ship) => {
    // Add HTTP port (Urbit ship port)
    ports.push(ship.httpPort);

    // Extract web server port from webUrl (e.g., "http://localhost:3000" -> "3000")
    const webUrlMatch = ship.webUrl.match(/:(\d+)$/);
    if (webUrlMatch) {
      ports.push(webUrlMatch[1]);
    }

    // Add loopback port if it exists
    if (ship.loopbackPort) {
      ports.push(ship.loopbackPort);
    }
  });

  // Remove duplicates and kill processes on all ports
  const uniquePorts = Array.from(new Set(ports));
  for (const port of uniquePorts) {
    try {
      // First try lsof (most common)
      try {
        childProcess.execSync(
          `command -v lsof >/dev/null 2>&1 && lsof -ti:${port} | xargs kill -9 2>/dev/null || true`,
          { stdio: 'ignore' }
        );
      } catch {
        // If lsof doesn't exist, try fuser as fallback
        try {
          childProcess.execSync(
            `command -v fuser >/dev/null 2>&1 && fuser -k ${port}/tcp 2>/dev/null || true`,
            { stdio: 'ignore' }
          );
        } catch {
          // Neither tool available - skip port cleanup
        }
      }
    } catch (error) {
      // Ignore errors - processes might not exist
    }
  }

  // Clean up PID file
  try {
    fs.unlinkSync(pidFile);
  } catch {}

  // Verify cleanup was successful
  try {
    const remainingUrbit = childProcess
      .execSync(
        `ps aux | grep urbit | grep "rube/dist" | grep -v grep | wc -l`,
        { encoding: 'utf8' }
      )
      .trim();

    if (remainingUrbit !== '0') {
      console.log(
        `⚠️ Warning: ${remainingUrbit} Urbit processes may still be running after cleanup`
      );
      console.log('  Run ./rube-cleanup.sh for complete cleanup');
    }
  } catch {
    // Ignore verification errors
  }

  console.log('Cleanup complete!');

  // Exit the process after cleanup
  process.exit(0);
}

async function waitForReadiness() {
  console.log('🔍 Checking Urbit ship readiness');

  // Import ship manifest to get Urbit ship URLs (not web server URLs)
  // Note: __dirname will be rube/dist when compiled, so we need to go up two levels
  const shipManifest = require('../../e2e/shipManifest.json');
  const shipUrls = Object.values(shipManifest)
    .filter((ship: Ship) => !ship.skipSetup)
    .map((ship: Ship) => ship.url);

  const maxAttempts = 60; // 5 minutes
  let attempts = 0;
  const startTime = Date.now();

  while (attempts < maxAttempts) {
    try {
      // Check if all Urbit ships are responding
      const checks = shipUrls.map((url) =>
        fetch(`${url}/~/scry/hood/kiln/pikes.json`)
          .then((res) => res.status < 500)
          .catch(() => false)
      );

      const results = await Promise.all(checks);

      if (results.every((ready) => ready)) {
        // Clear the current line and show success
        process.stdout.write('\r' + ' '.repeat(60) + '\r');
        console.log(
          '✅ All Urbit ships are ready! (Web servers will be started by Playwright)'
        );
        return true;
      }
    } catch (error) {
      // Continue waiting
    }

    attempts++;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const timeoutIn = Math.floor((maxAttempts * 5 - elapsed) / 60);
    process.stdout.write(
      `\r   Checking ships... ${elapsed}s elapsed (timeout in ~${timeoutIn}m)`
    );

    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
  }

  throw new Error('Timeout waiting for Urbit ships to be ready');
}

async function runTest(): Promise<void> {
  if (testFiles.length === 0) {
    throw new Error('Test file(s) required');
  }

  const flagsDisplay =
    playwrightFlags.length > 0
      ? ` with flags: ${playwrightFlags.join(' ')}`
      : '';
  
  // Display which tests are being run
  if (testFiles.length === 1) {
    console.log(`🧪 Running test: ${testFiles[0]}${flagsDisplay}`);
  } else {
    console.log(`🧪 Running ${testFiles.length} tests${flagsDisplay}:`);
    testFiles.forEach(file => console.log(`   - ${file}`));
  }

  return new Promise<void>((resolve, reject) => {
    // Build the command arguments: playwright test [flags] testFile1 testFile2 ... --retries=0
    const args: string[] = [
      'playwright',
      'test',
      ...playwrightFlags,
      ...testFiles,
      '--retries=0',
      '--reporter=list', // Use list reporter instead of HTML to avoid serving report
    ];

    const testProcess = childProcess.spawn('npx', args, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '../..'), // Go up two levels from rube/dist
    } as childProcess.SpawnOptions);

    testProcess.on('close', (code: number | null) => {
      if (code === 0) {
        console.log('✅ Tests completed successfully!');
        resolve();
      } else {
        console.log(`❌ Tests failed with exit code ${code}`);
        reject(new Error(`Tests failed with exit code ${code}`));
      }
    });

    testProcess.on('error', (error: Error) => {
      console.error('Failed to start test process:', error);
      reject(error);
    });
  });
}

async function main() {
  try {
    // Check for existing instance
    if (fs.existsSync(pidFile)) {
      try {
        const oldPid = parseInt(fs.readFileSync(pidFile, 'utf8'));
        process.kill(oldPid, 0);
        console.error(
          '❌ Another run-selected-tests instance is already running!'
        );
        console.error(`PID: ${oldPid}`);
        console.error('Kill it first or wait for it to complete.');
        process.exit(1);
      } catch {
        // Process doesn't exist, clean up stale file
        fs.unlinkSync(pidFile);
      }
    }

    // Save our PID
    fs.writeFileSync(pidFile, process.pid.toString());

    console.log(
      '🚀 Starting ships and web servers (without running full test suite)...'
    );

    // Start rube with SKIP_TESTS flag to only setup ships
    rubeProcess = childProcess.spawn('pnpm', ['rube'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: path.join(__dirname, '../..'), // Go up two levels from rube/dist
      // Don't detach - we want it to be part of our process group for cleanup
      env: {
        ...process.env,
        SKIP_TESTS: 'true', // This tells rube to stop before running tests
      },
    });

    let setupComplete = false;

    // Log rube output and watch for completion signal
    if (rubeProcess.stdout) {
      rubeProcess.stdout.on('data', (data: Buffer) => {
        const output = data.toString();
        process.stdout.write(`[rube] ${output}`);

        // Look for the signal that ship setup is complete
        if (output.includes('SHIP_SETUP_COMPLETE')) {
          console.log('✅ Ship setup detected as complete!');
          setupComplete = true;
        }
      });
    }

    if (rubeProcess.stderr) {
      rubeProcess.stderr.on('data', (data: Buffer) => {
        process.stderr.write(`[rube] ${data}`);
      });
    }

    rubeProcess.on('error', (error: Error) => {
      console.error('Failed to start rube:', error);
      process.exit(1);
    });

    rubeProcess.on('close', (code: number | null) => {
      if (!isShuttingDown && !setupComplete) {
        console.error(`Rube process exited unexpectedly with code ${code}`);
        process.exit(1);
      }
    });

    // Wait for ships to be ready by checking setupComplete flag
    await new Promise<void>((resolve) => {
      let dots = 0;
      const startTime = Date.now();
      let timer: NodeJS.Timeout | null = null;

      console.log('⏳ Waiting for ships to complete setup');

      const checkSetup = () => {
        if (isShuttingDown) {
          // Stop the timer if we're shutting down
          if (timer) clearTimeout(timer);
          resolve();
          return;
        }

        if (setupComplete) {
          // Clear the current line and print completion message
          process.stdout.write('\r' + ' '.repeat(60) + '\r');
          console.log('✅ Ships are set up, checking readiness...');
          resolve();
        } else {
          // Show progress with dots and elapsed time
          dots = (dots + 1) % 4;
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const dotString = '.'.repeat(dots) + ' '.repeat(3 - dots);
          const timeString = `${elapsed}s`;

          process.stdout.write(
            `\r   Setting up ships${dotString} (${timeString})`
          );
          timer = setTimeout(checkSetup, 1000);
        }
      };
      checkSetup();
    });

    await waitForReadiness();

    // Run the test(s)
    await runTest();

    console.log('🎉 Test run complete!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    cleanup();
  }
}

main();
