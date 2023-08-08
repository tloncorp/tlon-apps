import * as tar from 'tar-fs';
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as zlib from 'zlib';
import { spawn } from 'child_process';

const ships: Record<
  string,
  {
    url: string;
    savePath: string;
    extractPath: string;
    ship: string;
    httpPort: string;
  }
> = {
  zod: {
    url: 'https://bootstrap.urbit.org/rube-zod3.tgz',
    savePath: path.join(__dirname, 'rube-zod3.tgz'),
    extractPath: path.join(__dirname, 'zod'),
    ship: 'zod',
    httpPort: '35453',
  },
  bus: {
    url: 'https://bootstrap.urbit.org/rube-bus3.tgz',
    savePath: path.join(__dirname, 'rube-bus3.tgz'),
    extractPath: path.join(__dirname, 'bus'),
    ship: 'bus',
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
          return 'https://urbit.org/install/linux-x86_64/latest';
        case 'arm64':
          return 'https://urbit.org/install/linux-aarch64/latest';
        default:
          throw new Error(`unsupported arch ${arch}`);
      }
    case 'darwin':
      switch (arch) {
        case 'x64':
          return 'https://urbit.org/install/macos-x86_64/latest';
        case 'arm64':
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
    } else {
      console.log(`Skipping download of ${ship} as it already exists`);
      if (fs.existsSync(extractPath)) {
        fs.rmSync(extractPath, { recursive: true });
      }
      await extractFile(savePath, extractPath);
    }
  }
};

const getUrbitBinary = async () => {
  const url = getUrbitBinaryUrlByPlatformAndArch();
  const savePath = path.join(__dirname, 'urbit_binary.tgz');
  const extractPath = path.join(__dirname, 'urbit_extracted');

  await downloadFile(url, savePath);
  await extractFile(savePath, extractPath);

  const extracedFiles = fs.readdirSync(extractPath);

  if (extracedFiles.length > 0) {
    const mainFile = extracedFiles[0];
    fs.renameSync(
      path.join(extractPath, mainFile),
      path.join(extractPath, 'urbit')
    );
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

const bootAllShips = () => {
  const binaryPath = path.join(__dirname, 'urbit_extracted', 'urbit');

  Object.values(ships).forEach(({ extractPath, ship, httpPort }) => {
    bootShip(binaryPath, path.join(extractPath, ship), httpPort);
  });
};

const main = async () => {
  await getPiers();
  await getUrbitBinary();

  bootAllShips();
};

main();
