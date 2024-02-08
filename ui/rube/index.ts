/* eslint no-restricted-syntax: 0 */
/* eslint no-continue: 0 */
/* eslint no-await-in-loop: 0 */
/* eslint no-console: 0 */
import * as tar from 'tar-fs';
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as zlib from 'zlib';
import * as fsExtra from 'fs-extra';
import * as childProcess from 'child_process';

// TODO: write a script to update and package a pier then upload it to gcs

const spawnedProcesses: childProcess.ChildProcess[] = [];
const startHashes: { [ship: string]: { [desk: string]: string } } = {};

const manifestPath = path.join(
  __dirname,
  '..',
  '..',
  'e2e',
  'shipManifest.json'
);
const shipManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const ships: Record<
  string,
  {
    authFile: string;
    downloadUrl: string;
    url: string;
    savePath: string;
    extractPath: string;
    ship: string;
    code: string;
    httpPort: string;
    loopbackPort: string;
    webUrl: string;
  }
> = {
  zod: {
    ...shipManifest['~zod'],
    savePath: path.join(
      __dirname,
      shipManifest['~zod'].downloadUrl.split('/').pop()!
    ), // eslint-disable-line
    extractPath: path.join(__dirname, 'zod'),
  },
  bus: {
    ...shipManifest['~bus'],
    savePath: path.join(
      __dirname,
      shipManifest['~bus'].downloadUrl.split('/').pop()!
    ), // eslint-disable-line
    extractPath: path.join(__dirname, 'bus'),
  },
  'habduc-patbud': {
    ...shipManifest['~habduc-patbud'],
    savePath: path.join(
      __dirname,
      shipManifest['~habduc-patbud'].downloadUrl.split('/').pop()!
    ), // eslint-disable-line
    extractPath: path.join(__dirname, 'habduc-patbud'),
  },
  'naldeg-mardev': {
    ...shipManifest['~naldeg-mardev'],
    savePath: path.join(
      __dirname,
      shipManifest['~naldeg-mardev'].downloadUrl.split('/').pop()!
    ), // eslint-disable-line
    extractPath: path.join(__dirname, 'naldeg-mardev'),
  },
};

const targetShip = process.env.SHIP_NAME;

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
  for (const { downloadUrl, savePath, extractPath, ship } of Object.values(
    ships
  )) {
    if (targetShip && targetShip !== ship) {
      continue;
    }

    if (!fs.existsSync(savePath)) {
      await downloadFile(downloadUrl, savePath);
      console.log(`Downloaded ${ship} to ${savePath}`);
    } else {
      console.log(`Skipping download of ${ship} as it already exists`);
      if (fs.existsSync(extractPath)) {
        fs.rmSync(extractPath, { recursive: true });
        console.log(`Removed existing ${extractPath}`);
      }
    }
    await extractFile(savePath, extractPath);
    console.log(`Extracted ${ship} to ${extractPath}`);
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

const killExistingUrbitProcesses = () =>
  new Promise<void>((resolve, reject) => {
    const pathToBinary = path.join(__dirname, 'urbit_extracted/urbit');
    console.log('Kill existing urbit processes');

    const command = `ps aux | grep urbit | grep ${pathToBinary} | awk '{print $2}' | xargs kill -9`;

    childProcess.exec(command, (error, stdout, stderr) => {
      if (error && !error.message.includes('No such process')) {
        console.error(`Error killing process: ${error.message}`);
        reject(error);
        return;
      }
      if (stderr && !stderr.includes('No such process')) {
        console.error(`stderr: ${stderr}`);
        resolve();
        return;
      }

      resolve();
      console.log(`stdout: ${stdout}`);
    });
  });

const bootShip = (
  binaryPath: string,
  pierPath: string,
  httpPort: string,
  ship: string
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

  urbitProcess.stdout.on('data', (data) => {
    console.log(`[Urbit STDOUT (${ship})]: ${data}`);
  });

  urbitProcess.stderr.on('data', (data) => {
    console.error(`[Urbit STDERR (${ship})]: ${data}`);
  });

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

const copyDesks = async () => {
  const groups = path.resolve(__dirname, '../../../desk');

  for (const ship of Object.values(ships)) {
    if (targetShip && targetShip !== ship.ship) {
      continue;
    }

    const groupsDir = path.join(ship.extractPath, ship.ship, 'groups');

    try {
      console.log(`Copying ${groups} to ${groupsDir}`);
      await fsExtra.copy(groups, groupsDir, { overwrite: true });
    } catch (e) {
      console.error('Error copying desks', e);
    }
  }
};

const bootAllShips = () => {
  const binaryPath = path.join(__dirname, 'urbit_extracted', 'urbit');

  Object.values(ships).forEach(({ extractPath, ship, httpPort }) => {
    if (targetShip && targetShip !== ship) {
      return;
    }

    bootShip(binaryPath, path.join(extractPath, ship), httpPort, ship);
  });
};

const postToUrbit = async (url: string, source: string, sink: any) => {
  const payload = {
    source: { dojo: source },
    sink,
  };

  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
};

const hoodCommand = async (ship: string, command: string, port: string) => {
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
    const maxAttempts = 10;
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
        const [port, _, type] = line.split(' ');
        if (type === 'loopback') {
          ships[ship].loopbackPort = port;
        }
      });
      console.log(
        `Found loopback port ${ships[ship].loopbackPort} for ${ship}`
      );
    });
    resolve();
  });

const mountDesks = async () => {
  console.log('Mounting desks on fake ships');

  for (const ship of Object.values(ships)) {
    if (targetShip && targetShip !== ship.ship) {
      continue;
    }

    await hoodCommand(ship.ship, `mount %groups`, ship.loopbackPort);
  }
};

const commitDesks = async () => {
  console.log('Committing desks on fake ships');

  for (const ship of Object.values(ships)) {
    if (targetShip && targetShip !== ship.ship) {
      continue;
    }

    await hoodCommand(ship.ship, `commit %groups`, ship.loopbackPort);
  }
};

const login = async () => {
  console.log('Logging in to fake ships');

  for (const ship of Object.values(ships)) {
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

const getCookiesForShip = (ship: string): string | null => {
  const cookieFilePath = path.join(__dirname, `.cookies.${ship}.txt`);

  if (fs.existsSync(cookieFilePath)) {
    return fs.readFileSync(cookieFilePath, 'utf8').trim();
  }

  return null;
};

const makeRequestWithCookies = async (ship: string, url: string) => {
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
  for (const ship of Object.values(ships)) {
    if (targetShip && targetShip !== ship.ship) {
      continue;
    }

    const response = await makeRequestWithCookies(
      ship.ship,
      `http://localhost:${ship.httpPort}/~/scry/hood/kiln/pikes.json`
    );

    const json = JSON.parse(response);

    startHashes[ship.ship] = {
      groups: json.groups.hash,
    };
    console.log(`Start hashes for ~${ship.ship}:`, startHashes[ship.ship]);
  }
};

const shipsAreReadyForTests = async () => {
  const shipsArray = Object.values(ships);
  const results = await Promise.all(
    shipsArray.map(async (ship) => {
      if (targetShip && targetShip !== ship.ship) {
        return true;
      }

      const response = await makeRequestWithCookies(
        ship.ship,
        `http://localhost:${ship.httpPort}/~/scry/hood/kiln/pikes.json`
      );

      const json = JSON.parse(response);

      if (json.groups.hash !== startHashes[ship.ship].groups) {
        console.log(`~${ship.ship} is ready`, json.groups.hash);
        return true;
      }

      console.log(`~${ship.ship} is not ready`, json.groups.hash);

      return false;
    })
  );

  return results.every((result) => result);
};

const checkShipReadinessForTests = async () =>
  new Promise<void>((resolve, reject) => {
    const maxAttempts = 10;
    let attempts = 0;

    const tryConnect = async () => {
      attempts += 1;

      const ready = await shipsAreReadyForTests();

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

const runPlaywrightTests = async () => {
  await checkShipReadinessForTests();

  // to do:
  // refactor this to be able to target specs individually
  // both ships will always be running and available for all tests/specs
  // so this function is no longer needed as it is here
  const runTestForShip = (ship: string) =>
    new Promise<void>((resolve, reject) => {
      console.log(`Running tests for ${ship}`);
      const playwrightArgs = ['playwright', 'test', '--workers=2', ''];

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
      const playwrightArgs = ['playwright', 'test', '--workers=2', ''];

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
      await runTestForShip(`~${targetShip}`);
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
  for (const proc of spawnedProcesses) {
    if (!proc.killed) {
      proc.kill();
    }
  }
  killExistingUrbitProcesses();
};

process.on('exit', cleanupSpawnedProcesses);
process.on('SIGINT', () => {
  // CTRL+C
  cleanupSpawnedProcesses();
  process.exit();
});
process.on('SIGTERM', () => {
  // Kill command
  cleanupSpawnedProcesses();
  process.exit();
});
process.on('uncaughtException', (err) => {
  // Unexpected error
  console.error('Uncaught exception:', err);
  cleanupSpawnedProcesses();
  process.exit(1);
});

const main = async () => {
  console.time('Total Script Execution');
  if (targetShip && !ships[targetShip]) {
    console.error(`Invalid ship name: ${targetShip}`);
    process.exit(1);
  }

  try {
    await getPiers();
    await getUrbitBinary();

    await killExistingUrbitProcesses();

    bootAllShips();

    await checkShipReadinessForCommands();
    await getPortsFromFiles();
    await mountDesks();
    await login();
    await getStartHashes();
    await copyDesks();
    await commitDesks();
    await runPlaywrightTests();

    console.timeEnd('Total Script Execution');
    process.exit(0);
  } catch (err) {
    console.error('Error running rube:', err);
    console.timeEnd('Total Script Execution');
    process.exit(1);
  }
};

main();
