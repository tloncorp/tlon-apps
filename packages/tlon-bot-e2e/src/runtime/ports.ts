import net from 'node:net';

import type { RuntimeEndpoints } from '../drivers/types.js';

export const FAKEZOD_ACCESS_CODES = {
  zod: 'lidlut-tabwed-pillex-ridrup',
  ten: 'lapseg-nolmel-riswen-hopryc',
  mug: 'ravsut-bolryd-hapsum-pastul',
} as const;

export async function allocatePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('failed to allocate TCP port')));
        return;
      }
      const port = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

export async function allocateRuntimeEndpoints(
  fixedPorts: Partial<{
    fakeModel: number;
    zod: number;
    ten: number;
    mug: number;
  }> = {}
): Promise<RuntimeEndpoints> {
  const fakeModelPort = fixedPorts.fakeModel ?? (await allocatePort());
  const zodPort = fixedPorts.zod ?? (await allocatePort());
  const tenPort = fixedPorts.ten ?? (await allocatePort());
  const mugPort = fixedPorts.mug ?? (await allocatePort());

  return {
    fakeModel: {
      containerBaseUrl: 'http://fake-model:4000',
      containerOpenAiBaseUrl: 'http://fake-model:4000/v1',
      hostBaseUrl: `http://127.0.0.1:${fakeModelPort}`,
      hostOpenAiBaseUrl: `http://127.0.0.1:${fakeModelPort}/v1`,
      hostPort: fakeModelPort,
    },
    ships: {
      zod: {
        ship: '~zod',
        code: FAKEZOD_ACCESS_CODES.zod,
        containerUrl: 'http://ships:8080',
        hostUrl: `http://127.0.0.1:${zodPort}`,
        hostPort: zodPort,
      },
      ten: {
        ship: '~ten',
        code: FAKEZOD_ACCESS_CODES.ten,
        containerUrl: 'http://ships:8081',
        hostUrl: `http://127.0.0.1:${tenPort}`,
        hostPort: tenPort,
      },
      mug: {
        ship: '~mug',
        code: FAKEZOD_ACCESS_CODES.mug,
        containerUrl: 'http://ships:8082',
        hostUrl: `http://127.0.0.1:${mugPort}`,
        hostPort: mugPort,
      },
    },
  };
}
