#!/usr/bin/env node
import * as childProcess from 'child_process';
import * as fs from 'fs';
import fetch from 'node-fetch';
import * as path from 'path';

import { Ship } from './index';

interface WebServer {
  ship: string;
  port: number;
  shipUrl: string;
  webUrl: string;
  process?: childProcess.ChildProcess;
}

let rubeProcess: childProcess.ChildProcess | null = null;
let webServers: WebServer[] = [];
let isShuttingDown = false;

// Load ship manifest
const manifestPath = path.join(
  __dirname,
  '..',
  '..',
  'e2e',
  'shipManifest.json'
);
const shipManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Handle cleanup on exit - make synchronous for reliability
process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});
process.on('exit', cleanup);

function cleanup() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('\n🧹 Cleaning up...');

  // Kill web servers with proper process group cleanup
  if (webServers.length > 0) {
    console.log('Stopping web servers...');
    for (const server of webServers) {
      if (server.process && !server.process.killed && server.process.pid) {
        try {
          process.kill(-server.process.pid, 'SIGTERM');
        } catch (error) {
          console.log(`Web server for ${server.ship} already terminated`);
        }
      }
    }
  }

  // Kill rube process first
  if (rubeProcess && !rubeProcess.killed && rubeProcess.pid) {
    console.log('Stopping ships...');
    try {
      // Try graceful termination first
      rubeProcess.kill('SIGTERM');

      // Wait briefly for graceful shutdown
      const timeout = Date.now() + 1000;
      while (Date.now() < timeout) {
        try {
          process.kill(rubeProcess.pid, 0);
        } catch {
          break; // Process is dead
        }
      }

      // Force kill if still running
      try {
        rubeProcess.kill('SIGKILL');
      } catch {}
    } catch (error) {
      console.log('Rube process already terminated');
    }
  }

  // CRITICAL: Use pattern-based killing to clean up all Urbit processes
  // This is necessary because Urbit spawns serf sub-processes that aren't tracked
  try {
    // Kill all Urbit processes matching our rube pattern
    const killUrbitCmd = `ps aux | grep urbit | grep "rube/dist" | grep -v grep | awk '{print $2}' | while read pid; do kill -9 $pid 2>/dev/null; done`;
    childProcess.execSync(killUrbitCmd, { stdio: 'ignore' });

    // Also kill any Vite dev server processes
    const killViteCmd = `ps aux | grep "vite dev" | grep -v grep | awk '{print $2}' | while read pid; do kill -9 $pid 2>/dev/null; done`;
    childProcess.execSync(killViteCmd, { stdio: 'ignore' });
  } catch {
    // Ignore errors - processes might not exist
  }

  // Additional cleanup - kill any remaining processes on our ports (synchronous)
  const ports: string[] = [];
  Object.values(shipManifest).forEach((ship: Ship) => {
    ports.push(ship.httpPort);
    const webUrlMatch = ship.webUrl.match(/:(\d+)$/);
    if (webUrlMatch) {
      ports.push(webUrlMatch[1]);
    }
    if (ship.loopbackPort) {
      ports.push(ship.loopbackPort);
    }
  });

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

  console.log('Cleanup complete!');
}

function extractPortFromWebUrl(webUrl: string): number {
  const match = webUrl.match(/:(\d+)$/);
  if (!match) {
    throw new Error(`Could not extract port from webUrl: ${webUrl}`);
  }
  return parseInt(match[1], 10);
}

async function startShips(): Promise<void> {
  console.log('🚀 Starting Urbit ships...');

  return new Promise((resolve, reject) => {
    rubeProcess = childProcess.spawn('pnpm', ['e2e'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: path.join(__dirname, '../..'),
      detached: true,
      env: {
        ...process.env,
        SKIP_TESTS: 'true',
      },
    });

    let setupComplete = false;

    if (rubeProcess.stdout) {
      rubeProcess.stdout.on('data', (data: Buffer) => {
        const output = data.toString();
        process.stdout.write(`[ships] ${output}`);

        if (output.includes('SHIP_SETUP_COMPLETE')) {
          console.log('✅ Ships are ready!');
          setupComplete = true;
          resolve();
        }
      });
    }

    if (rubeProcess.stderr) {
      rubeProcess.stderr.on('data', (data: Buffer) => {
        process.stderr.write(`[ships] ${data}`);
      });
    }

    rubeProcess.on('error', (error: Error) => {
      console.error('Failed to start ships:', error);
      reject(error);
    });

    rubeProcess.on('close', (code: number | null) => {
      if (!isShuttingDown && !setupComplete) {
        console.error(`Ships process exited unexpectedly with code ${code}`);
        reject(new Error(`Ships process exited with code ${code}`));
      }
    });
  });
}

async function startWebServers(): Promise<void> {
  console.log('🌐 Starting web servers...');

  // Create web server configurations from ship manifest
  webServers = Object.entries(shipManifest)
    .filter(([, ship]: [string, Ship]) => !ship.skipSetup)
    .map(([key, ship]: [string, Ship]) => ({
      ship: key,
      port: extractPortFromWebUrl(ship.webUrl),
      shipUrl: ship.url,
      webUrl: ship.webUrl,
    }));

  // Start each web server
  for (const server of webServers) {
    console.log(
      `  Starting web server for ${server.ship} on port ${server.port}...`
    );

    const webServerProcess = childProcess.spawn(
      'pnpm',
      ['dev-no-ssl', '--port', server.port.toString()],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: path.join(__dirname, '../..'),
        detached: true,
        env: {
          ...process.env,
          SHIP_URL: server.shipUrl,
          VITE_DISABLE_SPLASH_MODAL: 'true',
        },
      }
    );

    server.process = webServerProcess;

    webServerProcess.stdout?.on('data', (data: Buffer) => {
      process.stdout.write(`[web:${server.ship}] ${data}`);
    });

    webServerProcess.stderr?.on('data', (data: Buffer) => {
      process.stderr.write(`[web:${server.ship}] ${data}`);
    });

    webServerProcess.on('error', (error: Error) => {
      console.error(`Failed to start web server for ${server.ship}:`, error);
    });

    webServerProcess.on('close', (code: number | null) => {
      if (!isShuttingDown) {
        console.error(`Web server for ${server.ship} exited with code ${code}`);
      }
    });
  }
}

async function waitForWebServers(): Promise<void> {
  console.log('🔍 Waiting for web servers to be ready...');

  const maxAttempts = 60; // 5 minutes
  let attempts = 0;
  const startTime = Date.now();

  while (attempts < maxAttempts) {
    try {
      // Check if all web servers are responding
      const checks = webServers.map((server) =>
        fetch(`${server.webUrl}/apps/groups/`)
          .then((res) => res.status < 500)
          .catch(() => false)
      );

      const results = await Promise.all(checks);

      if (results.every((ready) => ready)) {
        // Clear the current line and show success
        process.stdout.write('\r' + ' '.repeat(60) + '\r');
        console.log('✅ All web servers are ready!');
        return;
      }
    } catch (error) {
      // Continue waiting
    }

    attempts++;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const timeoutIn = Math.floor((maxAttempts * 5 - elapsed) / 60);
    process.stdout.write(
      `\r   Checking web servers... ${elapsed}s elapsed (timeout in ~${timeoutIn}m)`
    );

    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
  }

  throw new Error('Timeout waiting for web servers to be ready');
}

async function keepRunning(): Promise<void> {
  console.log('\n🎉 Environment ready for Playwright MCP development!');
  console.log('\nAvailable endpoints (manual authentication required):');
  webServers.forEach((server) => {
    const ship = shipManifest[server.ship] as Ship;
    console.log(
      `  ${server.ship}: ${server.webUrl}/apps/groups/ (auth code: ${ship.code})`
    );
  });
  console.log(
    '\nNOTE: All ships require manual authentication when using MCP server.'
  );
  console.log('Enter the auth code shown above when you see the login page.');
  console.log('\nPress Ctrl+C to stop all services.\n');

  // Keep the process alive
  return new Promise(() => {}); // This will never resolve
}

async function main() {
  try {
    console.log('🚀 Starting complete e2e environment for Playwright MCP...\n');

    await startShips();
    await startWebServers();
    await waitForWebServers();
    await keepRunning();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    cleanup();
  }
}

main();
