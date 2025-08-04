#!/usr/bin/env node
import * as childProcess from 'child_process';
import * as fs from 'fs';
import fetch from 'node-fetch';
import * as path from 'path';

import { Ship } from './index';

// Parse command line arguments
const args = process.argv.slice(2);
const testFile = args.find((arg) => arg.endsWith('.spec.ts'));
const playwrightFlags = args.filter((arg) => !arg.endsWith('.spec.ts'));

if (!testFile) {
  console.error('Usage: pnpm e2e:test [flags] <test-file.spec.ts>');
  console.error('Examples:');
  console.error('  pnpm e2e:test chat-functionality.spec.ts');
  console.error('  pnpm e2e:test --debug chat-functionality.spec.ts');
  console.error('  pnpm e2e:test --headed --debug chat-functionality.spec.ts');
  console.error('');
  console.error('Common flags: --debug, --headed, --ui, --trace=on');
  process.exit(1);
}

// Validate that the test file exists
// Note: __dirname will be rube/dist when compiled, so we need to go up two levels
const testPath = path.join(__dirname, '../../e2e', testFile);
if (!fs.existsSync(testPath)) {
  console.error(`❌ Test file not found: ${testFile}`);
  console.error(`   Expected location: ${testPath}`);
  console.error('');
  console.error('Available test files:');
  try {
    const e2eDir = path.join(__dirname, '../../e2e');
    const testFiles = fs
      .readdirSync(e2eDir)
      .filter((f) => f.endsWith('.spec.ts'));
    testFiles.forEach((file) => console.error(`   - ${file}`));
  } catch {
    console.error('   (Could not list available files)');
  }
  process.exit(1);
}

let rubeProcess: childProcess.ChildProcess | null = null;
let isShuttingDown = false;

// Handle cleanup on exit
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

async function cleanup() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('\n🧹 Cleaning up...');

  if (rubeProcess && !rubeProcess.killed && rubeProcess.pid) {
    console.log('Killing rube process...');
    try {
      // Kill the entire process group to ensure all child processes are terminated
      process.kill(-rubeProcess.pid, 'SIGTERM');
    } catch (error) {
      console.log('Process already terminated');
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
      childProcess.exec(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`);
    } catch (error) {
      // Ignore errors - processes might not exist
    }
  }

  console.log('Cleanup complete!');
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
  if (!testFile) {
    throw new Error('Test file is required');
  }

  const flagsDisplay =
    playwrightFlags.length > 0
      ? ` with flags: ${playwrightFlags.join(' ')}`
      : '';
  console.log(`🧪 Running test: ${testFile}${flagsDisplay}`);

  return new Promise<void>((resolve, reject) => {
    // Build the command arguments: playwright test [flags] testFile --retries=0
    const args: string[] = [
      'playwright',
      'test',
      ...playwrightFlags,
      testFile,
      '--retries=0',
    ];

    const testProcess = childProcess.spawn('npx', args, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '../..'), // Go up two levels from rube/dist
    } as childProcess.SpawnOptions);

    testProcess.on('close', (code: number | null) => {
      if (code === 0) {
        console.log('✅ Test completed successfully!');
        resolve();
      } else {
        console.log(`❌ Test failed with exit code ${code}`);
        reject(new Error(`Test failed with exit code ${code}`));
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
    console.log(
      '🚀 Starting ships and web servers (without running full test suite)...'
    );

    // Start rube with SKIP_TESTS flag to only setup ships
    rubeProcess = childProcess.spawn('pnpm', ['rube'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: path.join(__dirname, '../..'), // Go up two levels from rube/dist
      detached: true, // Create a new process group
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

      console.log('⏳ Waiting for ships to complete setup');

      const checkSetup = () => {
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
          setTimeout(checkSetup, 1000);
        }
      };
      checkSetup();
    });

    await waitForReadiness();

    // Run the single test
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
