/* eslint no-restricted-syntax: 0 */

/* eslint no-continue: 0 */

/* eslint no-await-in-loop: 0 */

/* eslint no-console: 0 */
import * as childProcess from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as fsExtra from 'fs-extra';
import fetch from 'node-fetch';
import * as os from 'os';
import * as path from 'path';
import * as tar from 'tar-fs';
import * as zlib from 'zlib';

// Load .env.test file if it exists
const envTestPath = path.join(__dirname, '..', '..', '.env.test');
if (fs.existsSync(envTestPath)) {
  const envContent = fs.readFileSync(envTestPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    // Skip comments and empty lines
    if (line && !line.startsWith('#') && line.includes('=')) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();
      // Only set if not already set (allow command-line overrides)
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    }
  });
  console.log('Loaded environment variables from .env.test');
}

const spawnedProcesses: childProcess.ChildProcess[] = [];
const startHashes: { [ship: string]: { [desk: string]: string } } = {};
const rubeDir = __dirname;
const pidFile = path.join(rubeDir, '.rube.pid');
const childrenFile = path.join(rubeDir, '.rube-children.json');

const manifestPath = path.join(
  __dirname,
  '..',
  '..',
  'e2e',
  'shipManifest.json'
);
const shipManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

export interface Ship {
  authFile: string;
  downloadUrl: string;
  url: string;
  ship: string;
  code: string;
  httpPort: string;
  loopbackPort: string;
  webUrl: string;
  savePath: string;
  extractPath: string;
  skipCommit: boolean;
  skipSetup: boolean;
}

function getShips(): Record<string, Ship> {
  return Object.fromEntries(
    Object.entries(shipManifest)
      .filter(([, value]) => {
        const v = value as Ship;
        return !v.skipSetup;
      })
      .map(([, value]) => {
        const v = value as Ship;
        const ship = v.ship;
        return [
          ship,
          {
            ...v,
            savePath: path.join(
              __dirname,
              v.downloadUrl.split('/').pop() || ''
            ),
            extractPath: path.join(__dirname, ship),
          },
        ];
      })
  );
}

const ships = getShips();
const SHIP_NAMES = Object.keys(ships) as Array<keyof typeof ships>;
type ShipName = (typeof SHIP_NAMES)[number];

const targetShip = process.env.SHIP_NAME;
const forceExtraction = process.env.FORCE_EXTRACTION === 'true';

const getUrbitBinaryUrlByPlatformAndArch = () => {
  const platform = os.platform();
  const arch = os.arch();

  switch (platform) {
    case 'linux':
      switch (arch) {
        case 'x64':
          console.log('Downloading linux-x86_64');
          return 'https://urbit.org/install/linux-x86_64/latest';
        case 'arm64':
          console.log('Downloading linux-aarch64');
          return 'https://urbit.org/install/linux-aarch64/latest';
        default:
          throw new Error(`unsupported arch ${arch}`);
      }
    case 'darwin':
      switch (arch) {
        case 'x64':
          console.log('Downloading macos-x86_64');
          return 'https://urbit.org/install/macos-x86_64/latest';
        case 'arm64':
          console.log('Downloading macos-aarch64');
          return 'https://urbit.org/install/macos-aarch64/latest';
        default:
          throw new Error(`unsupported arch ${arch}`);
      }
    default:
      throw new Error(`unsupported platform ${platform}`);
  }
};

const downloadFile = async (url: string, savePath: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`unexpected response ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error(`no body in the response for ${url}`);
  }

  const fileStream = fs.createWriteStream(savePath);

  response.body.pipe(fileStream);

  return new Promise<string>((resolve, reject) => {
    fileStream.on('finish', () => resolve(savePath));
    fileStream.on('error', reject);
  });
};

const extractFile = async (filePath: string, extractPath: string) =>
  new Promise<string>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(zlib.createGunzip())
      .pipe(tar.extract(extractPath))
      .on('finish', () => resolve(extractPath))
      .on('error', reject);
  });

const getPiers = async () => {
  for (const shipConfig of Object.values(ships) as Ship[]) {
    if (targetShip && targetShip !== shipConfig.ship) {
      continue;
    }

    const { downloadUrl, savePath, extractPath, ship } = shipConfig;

    // Download ship archive if it doesn't exist
    if (!fs.existsSync(savePath)) {
      await downloadFile(downloadUrl, savePath);
      console.log(`Downloaded ${ship} to ${savePath}`);
    } else {
      console.log(`Skipping download of ${ship} as it already exists`);
    }

    // Only extract if ship needs extraction or force extraction is enabled
    if (forceExtraction || shipNeedsExtraction(shipConfig)) {
      if (fs.existsSync(extractPath)) {
        fs.rmSync(extractPath, { recursive: true });
        console.log(`Removed existing ${extractPath}`);
      }
      await extractFile(savePath, extractPath);
      console.log(
        `Extracted ${ship} to ${extractPath}${forceExtraction ? ' (force extraction enabled)' : ''}`
      );
    }

    // Always clean up existing .http.ports file if it exists
    const httpPortsFilePath = path.join(extractPath, ship, '.http.ports');
    if (fs.existsSync(httpPortsFilePath)) {
      console.log('Remove existing .http-ports file');
      fs.rmSync(httpPortsFilePath);
    }
  }
};

const getUrbitBinary = async () => {
  const url = getUrbitBinaryUrlByPlatformAndArch();
  const savePath = path.join(__dirname, 'urbit_binary.tgz');
  const extractPath = path.join(__dirname, 'urbit_extracted');
  const finalName = path.join(extractPath, 'urbit');

  if (!fs.existsSync(finalName)) {
    await downloadFile(url, savePath);
    console.log(`Downloaded urbit binary to ${savePath}`);
    await extractFile(savePath, extractPath);
    console.log(`Extracted urbit binary to ${extractPath}`);

    const extractedFiles = fs.readdirSync(extractPath);

    if (extractedFiles.length > 0) {
      const mainFile = extractedFiles[0];
      fs.renameSync(path.join(extractPath, mainFile), finalName);
    }
  } else {
    console.log('Skipping download of urbit binary as it already exists');
  }
};

const killExistingUrbitProcesses = async (): Promise<void> => {
  console.log('Kill existing urbit processes');
  const command = killExistingUrbitCommand();

  return new Promise((resolve) => {
    childProcess.exec(
      command,
      { maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        // Always resolve - we don't want to fail if there's nothing to kill
        if (error) {
          // Only log if it's not a "no process" error
          if (
            !error.message.includes('No such process') &&
            !error.message.includes('SIGKILL')
          ) {
            console.log(`Note: ${error.message}`);
          }
        }
        if (stderr && !stderr.includes('No such process')) {
          console.log(`stderr: ${stderr}`);
        }
        if (stdout && stdout.trim()) {
          console.log(`Killed processes: ${stdout}`);
        }
        resolve();
      }
    );
  });
};

const bootShip = (
  binaryPath: string,
  pierPath: string,
  httpPort: string,
  ship: ShipName
) => {
  const lockPath = path.join(pierPath, '.vere.lock');

  if (fs.existsSync(lockPath)) {
    console.log('Remove existing .vere.lock file');
    fs.rmSync(lockPath);
  }

  console.log(
    `Booting ship ${pierPath} on port ${httpPort} with ${binaryPath}`
  );

  const urbitProcess = childProcess.spawn(binaryPath, [
    pierPath,
    '-d',
    '--http-port',
    httpPort,
  ]);

  spawnedProcesses.push(urbitProcess);

  if (urbitProcess.stdout) {
    urbitProcess.stdout.on('data', (data) => {
      console.log(`[Urbit STDOUT (${ship})]: ${data}`);
    });
  }

  if (urbitProcess.stderr) {
    urbitProcess.stderr.on('data', (data) => {
      console.error(`[Urbit STDERR (${ship})]: ${data}`);
    });
  }

  urbitProcess.on('close', (code) => {
    console.log(`Urbit process exited with code ${code}`);
  });

  urbitProcess.on('error', (err) => {
    console.error(`Urbit process errored with ${err}`);
  });

  process.on('exit', () => {
    urbitProcess.kill();
  });

  process.on('SIGINT', () => {
    urbitProcess.kill();
    process.exit();
  });
};

const copyDesks = async (): Promise<string[]> => {
  const groups = path.resolve(__dirname, '../../../../desk');
  const shipsNeedingUpdates: string[] = [];

  for (const ship of Object.values(ships) as Ship[]) {
    if (targetShip && targetShip !== ship.ship) {
      continue;
    }

    if (needsDeskUpdate(ship)) {
      const groupsDir = path.join(ship.extractPath, ship.ship, 'groups');

      try {
        console.log(`Copying desk changes to ${ship.ship}`);
        await fsExtra.copy(groups, groupsDir, { overwrite: true });
        shipsNeedingUpdates.push(ship.ship);
      } catch (e) {
        console.error('Error copying desks', e);
      }
    }
  }

  if (shipsNeedingUpdates.length === 0) {
    console.log('No ships need desk updates, skipping copy');
  }

  return shipsNeedingUpdates;
};

const bootAllShips = () => {
  const binaryPath = path.join(__dirname, 'urbit_extracted', 'urbit');

  Object.values(ships).forEach(({ extractPath, ship, httpPort }) => {
    if (targetShip && targetShip !== ship) {
      return;
    }

    bootShip(
      binaryPath,
      path.join(extractPath, ship),
      httpPort,
      ship as ShipName
    );
  });
};

const postToUrbit = async (
  url: string,
  source: string,
  sink: { app: string }
) => {
  const payload = {
    source: { dojo: source },
    sink,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Urbit command failed: ${response.status}`);
  }

  return response;
};

const hoodCommand = async (ship: ShipName, command: string, port: string) => {
  if (targetShip && targetShip !== ship) {
    return;
  }
  console.log(`Running ${command} on ${ship}`);

  await postToUrbit(`http://localhost:${port}`, `+hood/${command}`, {
    app: 'hood',
  });
};

const shipsAreReadyForCommands = () => {
  const shipsArray = Object.values(ships);
  const results = shipsArray.map(({ extractPath, ship }) => {
    if (targetShip && targetShip !== ship) {
      return true;
    }

    const httpPortFile = path.join(extractPath, ship, '.http.ports');
    if (fs.existsSync(httpPortFile)) {
      console.log(`Found ${httpPortFile}, ${ship} is ready for commands`);
      return true;
    }
    console.log(`Did not find ${httpPortFile}, ${ship} is not ready`);
    return false;
  });

  return results.every((result) => result);
};

const checkShipReadinessForCommands = async () =>
  new Promise<void>((resolve, reject) => {
    // We need to try more times if we're *not* forcing extraction because
    // the ships may need to run playback to get to a ready state
    const maxAttempts = forceExtraction ? 10 : 30;
    let attempts = 0;

    const checkForHttpsPorts = async () => {
      attempts += 1;

      const ready = shipsAreReadyForCommands();

      if (ready) {
        console.log('Ships are ready for commands');
        resolve();
      } else if (attempts < maxAttempts) {
        setTimeout(checkForHttpsPorts, 1000);
      } else {
        reject(new Error('Ships are not ready for commands'));
      }
    };

    checkForHttpsPorts();
  });

const parseLoopbackPort = (line: string): string | null => {
  const [port, , type] = line.split(' ');
  return type === 'loopback' ? port : null;
};

const getPortsFromFiles = async () =>
  new Promise<void>((resolve) => {
    console.log('Getting loopback ports from .http.ports files');
    const shipsArray = Object.values(ships);

    shipsArray.forEach(({ extractPath, ship }) => {
      if (targetShip && targetShip !== ship) {
        return;
      }

      const httpPortFile = path.join(extractPath, ship, '.http.ports');
      const contents = fs.readFileSync(httpPortFile, 'utf8');
      const lines = contents.split('\n');

      lines.forEach((line) => {
        const port = parseLoopbackPort(line);
        if (port) ships[ship].loopbackPort = port;
      });
      console.log(
        `Found loopback port ${ships[ship].loopbackPort} for ${ship}`
      );
    });
    resolve();
  });

const mountDesks = async () => {
  console.log('Mounting desks on all ships');

  for (const ship of Object.values(ships) as Ship[]) {
    if ((targetShip && targetShip !== ship.ship) || ship.skipCommit === true) {
      continue;
    }

    console.log(`Mounting groups on ${ship.ship}`);
    await hoodCommand(
      ship.ship as ShipName,
      `mount %groups`,
      ship.loopbackPort
    );
  }

  // Wait for mounts to complete
  await new Promise((resolve) => setTimeout(resolve, 2000));
};

const commitDesks = async (shipsNeedingUpdates: string[]) => {
  if (shipsNeedingUpdates.length === 0) {
    console.log('No ships need desk committing, skipping');
    return;
  }

  console.log(
    `Committing desks on ships that need updates: ${shipsNeedingUpdates.join(', ')}`
  );

  for (const ship of Object.values(ships) as Ship[]) {
    if ((targetShip && targetShip !== ship.ship) || ship.skipCommit === true) {
      continue;
    }

    if (shipsNeedingUpdates.includes(ship.ship)) {
      await hoodCommand(
        ship.ship as ShipName,
        `commit %groups`,
        ship.loopbackPort
      );
    }
  }
};

const nukeStateOnShips = async () => {
  for (const ship of Object.values(ships) as Ship[]) {
    if (targetShip && targetShip !== ship.ship) {
      continue;
    }

    try {
      console.log(`Nuking state on ${ship.ship}`);
      await hoodCommand(
        ship.ship as ShipName,
        'nuke %groups, =desk &, =hard &',
        ship.loopbackPort
      );
    } catch (e) {
      console.error(`Error nuking state on ${ship.ship}:`, e);
    }

    // Give the nuke command time to complete
    await new Promise((resolve) => setTimeout(resolve, 3000));

    try {
      console.log(`Reviving groups on ${ship.ship}`);
      await hoodCommand(
        ship.ship as ShipName,
        'revive %groups',
        ship.loopbackPort
      );
    } catch (e) {
      console.error(`Error reviving groups on ${ship.ship}:`, e);
    }
  }

  // Wait for revive to complete
  await new Promise((resolve) => setTimeout(resolve, 3000));
};

const login = async () => {
  console.log('Logging in to fake ships');

  for (const ship of Object.values(ships) as Ship[]) {
    if (targetShip && targetShip !== ship.ship) {
      continue;
    }

    const response = await fetch(`http://localhost:${ship.httpPort}/~/login`, {
      method: 'POST',
      body: `password=${ship.code}`,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to log in for ~${ship.ship}. Status: ${response.status}`
      );
    }

    const cookies = response.headers.get('set-cookie');

    if (cookies) {
      fs.writeFileSync(
        path.join(__dirname, `.cookies.${ship.ship}.txt`),
        cookies
      );
    }
  }
};

const getCookiesForShip = (ship: ShipName): string | null => {
  const cookieFilePath = path.join(__dirname, `.cookies.${ship}.txt`);

  if (fs.existsSync(cookieFilePath)) {
    return fs.readFileSync(cookieFilePath, 'utf8').trim();
  }

  return null;
};

const makeRequestWithCookies = async (ship: ShipName, url: string) => {
  const cookies = getCookiesForShip(ship);

  if (!cookies) {
    throw new Error(`No cookies found for ship ~${ship}`);
  }

  const response = await fetch(url, {
    headers: {
      Cookie: cookies,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Request failed for ship ~${ship}. Status: ${response.status}`
    );
  }

  const responseBody = await response.text();
  return responseBody;
};

const getStartHashes = async () => {
  for (const ship of Object.values(ships) as Ship[]) {
    if (targetShip && targetShip !== ship.ship) {
      continue;
    }

    const response = await makeRequestWithCookies(
      ship.ship as ShipName,
      `http://localhost:${ship.httpPort}/~/scry/hood/kiln/pikes.json`
    );

    const json = JSON.parse(response);

    startHashes[ship.ship] = {
      groups: json.groups.hash,
    };
    console.log(`Start hashes for ~${ship.ship}:`, startHashes[ship.ship]);
  }
};

const shipsAreReadyForTests = async (shipsNeedingUpdates: string[]) => {
  // If no ships needed updates, they're all ready
  if (shipsNeedingUpdates.length === 0) {
    console.log('No ships needed updates, all ships are ready for tests');
    return true;
  }

  const shipsArray = Object.values(ships);
  const results = await Promise.all(
    shipsArray.map(async (ship: Ship) => {
      if (
        (targetShip && targetShip !== ship.ship) ||
        ship.skipCommit === true
      ) {
        return true;
      }

      // If this ship didn't need updates, it's ready
      if (!shipsNeedingUpdates.includes(ship.ship)) {
        console.log(`~${ship.ship} didn't need updates, ready for tests`);
        return true;
      }

      const response = await makeRequestWithCookies(
        ship.ship as ShipName,
        `http://localhost:${ship.httpPort}/~/scry/hood/kiln/pikes.json`
      );

      const json = JSON.parse(response);

      if (
        json.groups.hash !== startHashes[ship.ship].groups &&
        ship.skipCommit === false
      ) {
        console.log(`~${ship.ship} is ready`, {
          groups: json.groups.hash,
        });
        return true;
      }

      console.log(`~${ship.ship} is not ready`, {
        groups: json.groups.hash,
      });

      return false;
    })
  );

  return results.every((result) => result);
};

const checkShipReadinessForTests = async (shipsNeedingUpdates: string[]) =>
  new Promise<void>((resolve, reject) => {
    const maxAttempts = 10;
    let attempts = 0;

    const tryConnect = async () => {
      attempts += 1;

      const ready = await shipsAreReadyForTests(shipsNeedingUpdates);

      if (ready) {
        resolve();
      } else if (attempts < maxAttempts) {
        setTimeout(tryConnect, 1000);
      } else {
        reject(new Error('Max attempts reached'));
      }
    };

    tryConnect();
  });

const runPlaywrightTests = async (shipsNeedingUpdates: string[]) => {
  await checkShipReadinessForTests(shipsNeedingUpdates);

  // to do:
  // refactor this to be able to target specs individually
  // both ships will always be running and available for all tests/specs
  // so this function is no longer needed as it is here
  const runTestForShip = (ship: ShipName) =>
    new Promise<void>((resolve, reject) => {
      console.log(`Running tests for ${ship}`);
      const playwrightArgs = ['playwright', 'test', '--workers=1'];

      if (process.env.DEBUG_PLAYWRIGHT) {
        playwrightArgs.push('--debug');
      }

      const testProcess = childProcess.spawn('npx', playwrightArgs, {
        env: {
          ...process.env,
          SHIP: ship,
        },
        stdio: 'inherit',
      });

      spawnedProcesses.push(testProcess);

      testProcess.on('close', (code) => {
        if (code !== 0) {
          reject(
            new Error(
              `Playwright tests failed for ${ship} with exit code ${code}`
            )
          );
        } else {
          resolve();
        }
      });
    });

  const runTests = () =>
    new Promise<void>((resolve, reject) => {
      console.log(`Running tests`);
      const playwrightArgs = ['playwright', 'test', '--workers=1', ''];

      if (process.env.DEBUG_PLAYWRIGHT) {
        playwrightArgs.push('--debug');
      }

      const testProcess = childProcess.spawn('npx', playwrightArgs, {
        env: {
          ...process.env,
        },
        stdio: 'inherit',
      });

      spawnedProcesses.push(testProcess);

      testProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Playwright tests failed with exit code ${code}`));
        } else {
          resolve();
        }
      });
    });

  try {
    if (targetShip) {
      await runTestForShip(targetShip as ShipName);
      console.log('All tests passed successfully!');
      process.exit(0);
      return;
    }
    await runTests();
    console.log('All tests passed successfully!');
  } catch (err) {
    console.error('Error running tests:', err);
    process.exit(1);
  }
};

const cleanupSpawnedProcesses = () => {
  console.log('Cleaning up spawned processes...');

  // First disconnect stdio to prevent output after exit
  spawnedProcesses.forEach((proc) => {
    if (!proc.killed && proc.pid) {
      try {
        // Disconnect stdio streams to prevent output
        if (proc.stdout) proc.stdout.destroy();
        if (proc.stderr) proc.stderr.destroy();
        if (proc.stdin) proc.stdin.destroy();
      } catch {
        // Ignore errors
      }
    }
  });

  // Then try graceful termination with SIGTERM for direct children
  spawnedProcesses.forEach((proc) => {
    if (!proc.killed && proc.pid) {
      try {
        console.log(`Killing process PID: ${proc.pid}`);
        proc.kill('SIGTERM');
      } catch {
        // Process may already be dead
      }
    }
  });

  // Give processes 1 second to terminate gracefully
  const timeout = Date.now() + 1000;
  while (Date.now() < timeout) {
    if (spawnedProcesses.every((p) => p.killed)) break;
  }

  // Force kill any remaining direct children
  spawnedProcesses.forEach((proc) => {
    if (!proc.killed && proc.pid) {
      try {
        proc.kill('SIGKILL');
      } catch {
        // Process may already be dead
      }
    }
  });

  // CRITICAL: Use pattern-based killing to clean up all Urbit processes
  // This is necessary because Urbit spawns serf sub-processes that aren't tracked
  try {
    // Kill all Urbit processes matching our rube pattern
    const killUrbitCmd = `ps aux | grep urbit | grep "rube/dist" | grep -v grep | awk '{print $2}' | while read pid; do kill -9 $pid 2>/dev/null; done`;
    childProcess.execSync(killUrbitCmd, { stdio: 'ignore' });

    // Also use our existing commands as additional cleanup
    childProcess.execSync(killExistingUrbitCommand(), { stdio: 'ignore' });
    childProcess.execSync(killExistingViteCommand(), { stdio: 'ignore' });

    // Kill any processes on our known ports
    const ports = [
      '35453',
      '36963',
      '38473',
      '39983',
      '3000',
      '3001',
      '3002',
      '3003',
    ];
    ports.forEach((port) => {
      try {
        // First try lsof (most common)
        try {
          const cmd = `command -v lsof >/dev/null 2>&1 && lsof -ti:${port} | xargs kill -9 2>/dev/null || true`;
          childProcess.execSync(cmd, { stdio: 'ignore' });
        } catch {
          // If lsof doesn't exist, try fuser as fallback
          try {
            const cmd = `command -v fuser >/dev/null 2>&1 && fuser -k ${port}/tcp 2>/dev/null || true`;
            childProcess.execSync(cmd, { stdio: 'ignore' });
          } catch {
            // Neither tool available - skip port cleanup
          }
        }
      } catch {
        // Ignore errors for ports that may not be in use
      }
    });
  } catch {
    // Ignore command errors
  }

  // Clean up PID files
  try {
    fs.unlinkSync(pidFile);
    fs.unlinkSync(childrenFile);
  } catch {
    // Ignore PID file cleanup errors
  }

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

  console.log('Cleanup complete.');
};

const killExistingUrbitCommand = (): string => {
  const pathToBinary = path.join(__dirname, 'urbit_extracted/urbit');
  // Use a subshell to handle empty xargs input gracefully on both macOS and Linux
  return `pids=$(ps aux | grep urbit | grep ${pathToBinary} | grep -v grep | awk '{print $2}'); [ -n "$pids" ] && echo "$pids" | xargs kill -9 2>/dev/null || true`;
};

const killExistingViteCommand = (): string => {
  // Use a subshell to handle empty xargs input gracefully on both macOS and Linux
  return `pids=$(ps aux | grep "vite dev" | grep -v grep | awk '{print $2}'); [ -n "$pids" ] && echo "$pids" | xargs kill -9 2>/dev/null || true`;
};

// Synchronous cleanup handlers for reliability
let hasCleanedUp = false;

const performCleanup = () => {
  if (hasCleanedUp) return;
  hasCleanedUp = true;
  cleanupSpawnedProcesses();
};

process.on('exit', (code) => {
  // Always try cleanup on exit if not done yet
  if (!hasCleanedUp) {
    console.log(`Process exiting with code ${code}, running cleanup...`);
    performCleanup();
  }
});

process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, cleaning up...');
  performCleanup();
  console.log('SIGINT cleanup finished.');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, cleaning up...');
  performCleanup();
  console.log('SIGTERM cleanup finished.');
  process.exit(0);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  cleanupSpawnedProcesses();
  console.log('Uncaught exception cleanup finished.');
  process.exit(1);
});

const getFileHash = (filePath: string): string => {
  if (!fs.existsSync(filePath)) {
    return '';
  }
  // Read as binary to handle all file types correctly
  const content = fs.readFileSync(filePath);
  return crypto
    .createHash('md5')
    .update(content as any)
    .digest('hex');
};

const compareSourceToTarget = (
  sourceDirPath: string,
  targetDirPath: string
): boolean => {
  if (!fs.existsSync(sourceDirPath) || !fs.existsSync(targetDirPath)) {
    return false;
  }

  const sourceFiles: string[] = [];
  const walk = (dir: string, basePath: string) => {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath, basePath);
      } else {
        const relativePath = path.relative(basePath, fullPath);
        sourceFiles.push(relativePath);
      }
    }
  };

  walk(sourceDirPath, sourceDirPath);

  // For each file in source, check if it exists in target and has same hash
  for (const relativeFilePath of sourceFiles) {
    const sourceFilePath = path.join(sourceDirPath, relativeFilePath);
    const targetFilePath = path.join(targetDirPath, relativeFilePath);

    // If target file doesn't exist, directories don't match
    if (!fs.existsSync(targetFilePath)) {
      return false;
    }

    // If file contents don't match, directories don't match
    const sourceHash = getFileHash(sourceFilePath);
    const targetHash = getFileHash(targetFilePath);
    if (sourceHash !== targetHash) {
      return false;
    }
  }

  return true;
};

const needsDeskUpdate = (ship: Ship): boolean => {
  const sourceDeskPath = path.resolve(__dirname, '../../../../desk');
  const targetGroupsPath = path.join(ship.extractPath, ship.ship, 'groups');

  // If target doesn't exist, we need to update
  if (!fs.existsSync(targetGroupsPath)) {
    return true;
  }

  // Compare only source files (ignore generated files in target)
  const sourcesMatch = compareSourceToTarget(sourceDeskPath, targetGroupsPath);

  return !sourcesMatch;
};

const shipNeedsExtraction = (ship: Ship): boolean => {
  const shipPath = path.join(ship.extractPath, ship.ship);

  // If ship directory doesn't exist, we need to extract
  if (!fs.existsSync(shipPath)) {
    return true;
  }

  // Check if the ship directory looks valid (has expected structure)
  const expectedFiles = ['.urb', '.bin', '.run', 'groups'];
  const hasValidStructure = expectedFiles.every((file) =>
    fs.existsSync(path.join(shipPath, file))
  );

  if (!hasValidStructure) {
    return true;
  }

  // Check if the downloaded archive is newer than the extracted ship
  if (fs.existsSync(ship.savePath)) {
    const archiveStats = fs.statSync(ship.savePath);
    const shipStats = fs.statSync(shipPath);

    // If archive is newer than ship directory, we need to extract
    if (archiveStats.mtime > shipStats.mtime) {
      console.log(
        `New ship version detected for ${ship.ship}, extraction needed`
      );
      return true;
    }
  }

  // Check if the groups directory matches the desk directory
  const sourceDeskPath = path.resolve(__dirname, '../../../../desk');
  const targetGroupsPath = path.join(shipPath, 'groups');

  // If groups directory doesn't exist, we need to extract
  if (!fs.existsSync(targetGroupsPath)) {
    return true;
  }

  // Compare only source files (ignore generated files in target)
  const sourcesMatch = compareSourceToTarget(sourceDeskPath, targetGroupsPath);

  return !sourcesMatch;
};

const executeClickCommand = async (
  ship: Ship,
  hoonCommand: string,
  options: { useKhan?: boolean } = {}
): Promise<string> => {
  const decodeClickResult = (out: string): string | null => {
    try {
      // Extract after '%noun' up to the next ']'
      const m = out.match(/%noun\s+([^\]]+)/);
      if (!m) return null;
      const payload = m[1].trim();

      // Case 1: space-separated byte values (tape)
      if (/^[0-9 ]+$/.test(payload)) {
        const bytes = payload
          .trim()
          .split(/\s+/)
          .map((n) => parseInt(n, 10))
          .filter((n) => Number.isFinite(n) && n > 0 && n < 256);
        if (bytes.length > 0) {
          return String.fromCharCode(...bytes);
        }
      }

      // Case 2: single atom (e.g., %ok -> 27503)
      if (/^\d+$/.test(payload)) {
        const n = parseInt(payload, 10);
        if (n === 27503) return '%ok';
        return String(payload);
      }

      return null;
    } catch {
      return null;
    }
  };
  return new Promise((resolve, reject) => {
    // Create a ship-specific wrapper script and a temp input file to leverage
    // click's -i mode, which safely escapes quotes/newlines for newt.
    const tmpId = Date.now();
    const tempWrapperPath = path.join(
      path.dirname(__dirname),
      `temp-click-${ship.ship}-${tmpId}.sh`
    );
    const tempInputPath = path.join(
      path.dirname(__dirname),
      `temp-click-input-${ship.ship}-${tmpId}.hoon`
    );

    const clickFlags = options.useKhan ? '-k' : '';
    const urbitBinary = path.join(__dirname, 'urbit_extracted', 'urbit');

    // Write Hoon source exactly as-is; click -i will escape it correctly.
    fs.writeFileSync(tempInputPath, hoonCommand, 'utf8');

    const wrapperContent = `#!/bin/bash\n./click -b ${urbitBinary} ${clickFlags} -i ${tempInputPath} ./dist/${ship.ship}/${ship.ship}\n`;

    console.log(
      `Creating temporary wrapper for ${ship.ship}: ${tempWrapperPath}`
    );
    fs.writeFileSync(tempWrapperPath, wrapperContent);
    fs.chmodSync(tempWrapperPath, '755');

    childProcess.exec(
      tempWrapperPath,
      {
        cwd: path.dirname(__dirname),
      },
      (
        error: childProcess.ExecException | null,
        stdout: string,
        stderr: string
      ) => {
        // Clean up temp wrapper and input
        try {
          if (fs.existsSync(tempWrapperPath)) {
            fs.unlinkSync(tempWrapperPath);
          } else {
            console.log(`Wrapper already deleted: ${tempWrapperPath}`);
          }
        } catch (e) {
          console.error(`Error deleting temp wrapper for ${ship.ship}:`, e);
        }
        try {
          if (fs.existsSync(tempInputPath)) {
            fs.unlinkSync(tempInputPath);
          } else {
            console.log(`Input file already deleted: ${tempInputPath}`);
          }
        } catch (e) {
          console.error(`Error deleting temp input for ${ship.ship}:`, e);
        }

        if (error) {
          console.error(
            `Click command failed for ${ship.ship}:`,
            error.message
          );
          reject(error);
          return;
        }
        if (stderr) {
          console.error(`Click stderr for ${ship.ship}:`, stderr);
        }
        console.log(`Successfully executed click command for ${ship.ship}`);
        const decoded = decodeClickResult(stdout);
        if (decoded !== null) {
          console.log(`Click result:`, decoded);
        } else {
          console.log(`Click stdout:`, stdout);
        }
        resolve(stdout);
      }
    );
  });
};

const setReelServiceShip = async () => {
  console.log('Setting reel service ship to ~mug on all ships');

  for (const ship of Object.values(ships) as Ship[]) {
    if (
      (targetShip && targetShip !== ship.ship) ||
      ship.skipCommit === true ||
      ship.ship === 'mug'
    ) {
      continue;
    }

    try {
      console.log(`Setting reel service ship to ~mug on ${ship.ship}`);

      // add a sleep to make sure the ship is ready
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Execute the click command using the generalized function
      const hoonCommand = `=/  m  (strand ,vase)  ;<  ~  bind:m  (poke [~${ship.ship} %reel] %reel-command !>([%set-ship ~mug]))  (pure:m !>(%ok))`;
      await executeClickCommand(ship, hoonCommand, { useKhan: true });
    } catch (e) {
      console.error(`Error setting service ship on ${ship.ship}:`, e);
    }
  }

  // Give the command time to complete
  await new Promise((resolve) => setTimeout(resolve, 2000));
};

const setStorageConfiguration = async () => {
  // Check if storage configuration environment variables are set
  const s3Endpoint = process.env.E2E_S3_ENDPOINT;
  const s3AccessKeyId = process.env.E2E_S3_ACCESS_KEY_ID;
  const s3SecretAccessKey = process.env.E2E_S3_SECRET_ACCESS_KEY;
  const s3BucketName = process.env.E2E_S3_BUCKET_NAME;
  const s3Region = process.env.E2E_S3_REGION || 'us-east-1';

  if (!s3Endpoint || !s3AccessKeyId || !s3SecretAccessKey || !s3BucketName) {
    console.log(
      'Storage configuration environment variables not set, skipping S3 setup'
    );
    console.log('To enable image uploads in e2e tests, set:');
    console.log(
      '  E2E_S3_ENDPOINT, E2E_S3_ACCESS_KEY_ID, E2E_S3_SECRET_ACCESS_KEY, E2E_S3_BUCKET_NAME'
    );
    return;
  }

  console.log('Configuring S3 storage on all ships');

  for (const ship of Object.values(ships) as Ship[]) {
    if ((targetShip && targetShip !== ship.ship) || ship.skipCommit === true) {
      continue;
    }

    try {
      console.log(`Configuring S3 storage on ${ship.ship}`);

      // Use khan thread to issue pure Hoon pokes (dojo syntax like :storage is not valid here)
      const toHoonTape = (s: string) =>
        s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

      // Set endpoint (single-line to avoid parser indentation issues)
      let hoonCommand = `=/  m  (strand ,vase)  ;<  ~  bind:m  (poke [~${ship.ship} %storage] %storage-action !>([%set-endpoint (crip "${toHoonTape(s3Endpoint)}")]))  (pure:m !>(%ok))`;
      await executeClickCommand(ship, hoonCommand, { useKhan: true });

      // Set access key ID
      hoonCommand = `=/  m  (strand ,vase)  ;<  ~  bind:m  (poke [~${ship.ship} %storage] %storage-action !>([%set-access-key-id (crip "${toHoonTape(s3AccessKeyId)}")]))  (pure:m !>(%ok))`;
      await executeClickCommand(ship, hoonCommand, { useKhan: true });

      // Set secret access key
      hoonCommand = `=/  m  (strand ,vase)  ;<  ~  bind:m  (poke [~${ship.ship} %storage] %storage-action !>([%set-secret-access-key (crip "${toHoonTape(s3SecretAccessKey)}")]))  (pure:m !>(%ok))`;
      await executeClickCommand(ship, hoonCommand, { useKhan: true });

      // Set region
      hoonCommand = `=/  m  (strand ,vase)  ;<  ~  bind:m  (poke [~${ship.ship} %storage] %storage-action !>([%set-region (crip "${toHoonTape(s3Region)}")]))  (pure:m !>(%ok))`;
      await executeClickCommand(ship, hoonCommand, { useKhan: true });

      // Set current bucket
      hoonCommand = `=/  m  (strand ,vase)  ;<  ~  bind:m  (poke [~${ship.ship} %storage] %storage-action !>([%set-current-bucket (crip "${toHoonTape(s3BucketName)}")]))  (pure:m !>(%ok))`;
      await executeClickCommand(ship, hoonCommand, { useKhan: true });

      console.log(`Successfully configured S3 storage on ${ship.ship}`);
    } catch (e) {
      console.error(`Error setting storage configuration on ${ship.ship}:`, e);
    }
  }

  // Give the commands time to complete
  await new Promise((resolve) => setTimeout(resolve, 2000));
};

const checkExistingInstance = (): boolean => {
  try {
    if (fs.existsSync(pidFile)) {
      const oldPid = parseInt(fs.readFileSync(pidFile, 'utf8'));
      // Check if process is still running
      try {
        process.kill(oldPid, 0);
        return true; // Process exists
      } catch {
        // Process doesn't exist, clean up stale file
        fs.unlinkSync(pidFile);
      }
    }
  } catch {
    // Ignore file read errors
  }
  return false;
};

const savePidFiles = () => {
  try {
    // Save main process PID
    fs.writeFileSync(pidFile, process.pid.toString());

    // Save children PIDs
    const childPids = spawnedProcesses.filter((p) => p.pid).map((p) => p.pid);
    fs.writeFileSync(childrenFile, JSON.stringify(childPids));
  } catch (e) {
    console.error('Error saving PID files:', e);
  }
};

const main = async () => {
  console.time('Total Script Execution');

  // Check for existing instance
  if (checkExistingInstance()) {
    console.error('❌ Another rube instance is already running!');
    console.error(`Check PID file: ${pidFile}`);
    console.error('To force cleanup, run: ./rube-cleanup.sh');
    process.exit(1);
  }

  if (targetShip && !ships[targetShip]) {
    console.error(`Invalid ship name: ${targetShip}`);
    process.exit(1);
  }

  if (forceExtraction) {
    console.log('🚨 Force extraction enabled - all ships will be re-extracted');
  }

  try {
    await getPiers();
    await getUrbitBinary();

    await killExistingUrbitProcesses();

    bootAllShips();
    savePidFiles(); // Save PIDs after spawning processes

    await checkShipReadinessForCommands();
    await getPortsFromFiles();
    await login();
    await getStartHashes();

    // Nuke state and set reel service ship before mount/commit operations,
    // this makes it more likely that the ships will be ready for click commands
    if (!process.env.FORCE_EXTRACTION) {
      await nukeStateOnShips();
    }
    await setReelServiceShip();
    await setStorageConfiguration();

    // Mount desks first so Urbit writes its current state to filesystem
    await mountDesks();

    // Copy desk changes to ships that need updates
    const shipsNeedingUpdates = await copyDesks();

    // Commit changes so Urbit reads our updates and updates its internal state
    await commitDesks(shipsNeedingUpdates);
    await checkShipReadinessForTests(shipsNeedingUpdates);

    // Check if we should skip running tests (for single test runner)
    if (process.env.SKIP_TESTS === 'true') {
      console.log(
        '✅ Ship setup complete! Skipping test execution as requested.'
      );
      console.log('SHIP_SETUP_COMPLETE');
      // Keep the process running so ships stay alive
      console.log('Ships and web servers are ready. Press Ctrl+C to stop.');

      // Keep the process alive by waiting indefinitely
      await new Promise(() => {}); // This will never resolve
      return;
    }

    await runPlaywrightTests(shipsNeedingUpdates);

    console.timeEnd('Total Script Execution');
    process.exit(0);
  } catch (err) {
    console.error('Error running rube:', err);
    console.timeEnd('Total Script Execution');
    process.exit(1);
  }
};

main();
