#!/usr/bin/env node
import * as childProcess from 'child_process';
import * as fs from 'fs';
import fetch from 'node-fetch';
import * as path from 'path';

import { Ship } from './index';

// Get the test file from command line arguments
const testFile = process.argv[2];

if (!testFile) {
  console.error('Usage: pnpm e2e:test <test-file.spec.ts>');
  console.error('Example: pnpm e2e:test chat-functionality.spec.ts');
  process.exit(1);
}

// Validate that the test file exists
// Note: __dirname will be rube/dist when compiled, so we need to go up two levels
const testPath = path.join(__dirname, '../../e2e', testFile);
if (!fs.existsSync(testPath)) {
  console.error(`Test file not found: ${testPath}`);
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
  const ports = ['3000', '3001', '3002', '35453', '36963', '38473'];
  for (const port of ports) {
    try {
      childProcess.exec(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`);
    } catch (error) {
      // Ignore errors - processes might not exist
    }
  }

  console.log('Cleanup complete!');
}

async function waitForReadiness() {
  console.log('⏳ Waiting for Urbit ships to be ready...');

  // Import ship manifest to get Urbit ship URLs (not web server URLs)
  // Note: __dirname will be rube/dist when compiled, so we need to go up two levels
  const shipManifest = require('../../e2e/shipManifest.json');
  const shipUrls = Object.values(shipManifest).map((ship: Ship) => ship.url);

  const maxAttempts = 60; // 5 minutes
  let attempts = 0;

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
        console.log(
          '✅ All Urbit ships are ready! (Web servers will be started by Playwright)'
        );
        return true;
      }
    } catch (error) {
      // Continue waiting
    }

    attempts++;
    process.stdout.write('.');
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
  }

  throw new Error('Timeout waiting for Urbit ships to be ready');
}

async function runTest(): Promise<void> {
  console.log(`🧪 Running test: ${testFile}`);

  return new Promise<void>((resolve, reject) => {
    const testProcess = childProcess.spawn(
      'npx',
      ['playwright', 'test', testFile, '--retries=0'],
      {
        stdio: 'inherit',
        cwd: path.join(__dirname, '../..'), // Go up two levels from rube/dist
      }
    );

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

    // Wait for ships to be ready
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
