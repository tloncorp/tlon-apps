import * as tar from 'tar-fs';
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as zlib from 'zlib';
import * as portscanner from 'portscanner';
import * as fsExtra from 'fs-extra';
import { spawn } from 'child_process';

const ships: Record<
  string,
  {
    url: string;
    savePath: string;
    extractPath: string;
    ship: string;
    code: string;
    httpPort: string;
  }
> = {
  zod: {
    url: 'https://bootstrap.urbit.org/rube-zod3.tgz',
    savePath: path.join(__dirname, 'rube-zod3.tgz'),
    extractPath: path.join(__dirname, 'zod'),
    ship: 'zod',
    code: 'lidlut-tabwed-pillex-ridrup',
    httpPort: '35453',
  },
  bus: {
    url: 'https://bootstrap.urbit.org/rube-bus3.tgz',
    savePath: path.join(__dirname, 'rube-bus3.tgz'),
    extractPath: path.join(__dirname, 'bus'),
    ship: 'bus',
    code: 'riddec-bicrym-ridlev-pocsef',
    httpPort: '36963',
  },
};

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
  for (const { url, savePath, extractPath, ship } of Object.values(ships)) {
    if (!fs.existsSync(savePath)) {
      await downloadFile(url, savePath);
      console.log(`Downloaded ${ship} to ${savePath}`);
    } else {
      console.log(`Skipping download of ${ship} as it already exists`);
      if (fs.existsSync(extractPath)) {
        fs.rmSync(extractPath, { recursive: true });
        console.log(`Removed existing ${extractPath}`);
      }
      await extractFile(savePath, extractPath);
      console.log(`Extracted ${ship} to ${extractPath}`);
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

    const extracedFiles = fs.readdirSync(extractPath);

    if (extracedFiles.length > 0) {
      const mainFile = extracedFiles[0];
      fs.renameSync(path.join(extractPath, mainFile), finalName);
    }
  } else {
    console.log('Skipping download of urbit binary as it already exists');
  }
};

const bootShip = (binaryPath: string, pierPath: string, httpPort: string) => {
  const urbitProcess = spawn(binaryPath, [
    pierPath,
    '-t',
    '--http-port',
    httpPort,
  ]);

  urbitProcess.stdout.on('data', (data) => {
    console.log(`[Urbit STDOUT]: ${data}`);
  });

  urbitProcess.stderr.on('data', (data) => {
    console.error(`[Urbit STDERR]: ${data}`);
  });

  urbitProcess.on('close', (code) => {
    console.log(`Urbit process exited with code ${code}`);
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
  const talk = path.resolve(__dirname, '../../../talk');

  const zodGroups = path.join(ships.zod.extractPath, 'zod', 'groups');
  const zodTalk = path.join(ships.zod.extractPath, 'zod', 'talk');
  const busGroups = path.join(ships.bus.extractPath, 'bus', 'groups');
  const busTalk = path.join(ships.bus.extractPath, 'bus', 'talk');

  try {
    console.log(`Copying ${groups} to ${zodGroups}`);
    await fsExtra.copy(groups, zodGroups, { overwrite: true });
    console.log(`Copying ${talk} to ${zodTalk}`);
    await fsExtra.copy(talk, zodTalk, { overwrite: true, dereference: true });

    console.log(`Copying ${groups} to ${busGroups}`);
    await fsExtra.copy(groups, busGroups, { overwrite: true });
    console.log(`Copying ${talk} to ${busTalk}`);
    await fsExtra.copy(talk, busTalk, { overwrite: true, dereference: true });
  } catch (e) {
    console.error('Error copying desks', e);
  }
};

const getAvailablePort = (startPort: number): Promise<number> => {
  return new Promise((resolve, reject) => {
    portscanner.findAPortNotInUse(
      startPort,
      startPort + 100,
      '127.0.0.1',
      (error, port) => {
        if (error) reject(error);
        else resolve(port);
      }
    );
  });
};

const bootAllShips = () => {
  const binaryPath = path.join(__dirname, 'urbit_extracted', 'urbit');

  Object.values(ships).forEach(({ extractPath, ship, httpPort }) => {
    bootShip(binaryPath, path.join(extractPath, ship), httpPort);
  });
};

const postToUrbit = async (url: string, source: string, sink: any) => {
  const payload = {
    source: { dojo: source },
    sink: sink,
  };

  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
};

const hoodZod = async (command: string, port: number) => {
  await postToUrbit(`http://localhost:${port}`, `+hood/${command}`, {
    app: 'hood',
  });
};

const hoodBus = async (command: string, port: number) => {
  await postToUrbit(`http://localhost:${port}`, `+hood/${command}`, {
    app: 'hood',
  });
};

const mountDesks = async (port1: number, port2: number) => {
  console.log('Mounting desks on fake ships');
  await hoodZod('mount %groups', port1);
  await hoodZod('mount %talk', port1);
  await hoodBus('mount %groups', port2);
  await hoodBus('mount %talk', port2);
};

const commitDesks = async (port1: number, port2: number) => {
  console.log('Committing desks on fake ships');
  await hoodZod('commit %groups', port1);
  await hoodZod('commit %talk', port1);
  await hoodBus('commit %groups', port2);
  await hoodBus('commit %talk', port2);
};

const login = async () => {
  console.log('Logging in to fake ships');

  for (const ship of Object.values(ships)) {
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

let startHashes: { [ship: string]: { [desk: string]: string } } = {};

const getStartHashes = async () => {
  for (const ship of Object.values(ships)) {
    const response = await makeRequestWithCookies(
      ship.ship,
      `http://localhost:${ship.httpPort}/~/scry/hood/kiln/pikes.json`
    );

    const json = JSON.parse(response);

    startHashes[ship.ship] = {
      groups: json['groups'].hash,
      talk: json['talk'].hash,
    };
    console.log(`Start hashes for ~${ship.ship}:`, startHashes[ship.ship]);
  }
};

const shipsAreReady = async () => {
  const shipsArray = Object.values(ships);
  const results = await Promise.all(
    shipsArray.map(async (ship) => {
      const response = await makeRequestWithCookies(
        ship.ship,
        `http://localhost:${ship.httpPort}/~/scry/hood/kiln/pikes.json`
      );

      const json = JSON.parse(response);

      if (
        json['groups'].hash !== startHashes[ship.ship].groups &&
        json['talk'].hash !== startHashes[ship.ship].talk
      ) {
        console.log(`~${ship.ship} is ready`, {
          groups: json['groups'].hash,
          talk: json['talk'].hash,
        });
        return true;
      }

      console.log(`~${ship.ship} is not ready`);

      return false;
    })
  );

  return results.every((result) => result);
};

const checkShipReadiness = async () =>
  new Promise<void>((resolve, reject) => {
    const maxAttempts = 10;
    let attempts = 0;

    const tryConnect = async () => {
      attempts += 1;

      const ready = await shipsAreReady();

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
  await checkShipReadiness();

  const runTestForShip = (ship: string) =>
    new Promise<void>((resolve, reject) => {
      console.log(`Running tests for ${ship}`);
      const testProcess = spawn('npx', ['playwright', 'test', '--workers=1'], {
        env: {
          ...process.env,
          SHIP: ship,
        },
        stdio: 'inherit',
      });

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

  try {
    await runTestForShip('~bus');
    await runTestForShip('~zod');
    console.log('All tests passed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error running tests:', err);
    process.exit(1);
  }
};

const main = async () => {
  await getPiers();
  await getUrbitBinary();
  const port1 = await getAvailablePort(12321);
  const port2 = await getAvailablePort(port1 + 1);

  bootAllShips();

  setTimeout(
    async () =>
      await mountDesks(port1, port2).then(async () => {
        await login();
        await getStartHashes();
        await copyDesks().then(async () => {
          await commitDesks(port1, port2).then(async () => {
            await runPlaywrightTests();
          });
        });
      }),
    2000
  );
};

main();
