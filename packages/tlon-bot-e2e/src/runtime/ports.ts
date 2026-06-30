import net from 'node:net';

import type { RuntimeEndpoints } from '../drivers/types.js';

export interface RuntimePortOverrides {
  fakeModel?: number;
  zod?: number;
  ten?: number;
  mug?: number;
  gateway?: number;
}

export interface RequestedRuntimePort {
  envVar: string;
  port: number;
}

export const FAKEZOD_ACCESS_CODES = {
  zod: 'lidlut-tabwed-pillex-ridrup',
  ten: 'lapseg-nolmel-riswen-hopryc',
  mug: 'ravsut-bolryd-hapsum-pastul',
} as const;

const RUNTIME_PORT_KEYS = [
  'fakeModel',
  'zod',
  'ten',
  'mug',
  'gateway',
] as const;

const RUNTIME_PORT_ENV_VARS: Record<keyof RuntimePortOverrides, string> = {
  fakeModel: 'FAKE_MODEL_PORT',
  zod: 'ZOD_PORT',
  ten: 'TEN_PORT',
  mug: 'MUG_PORT',
  gateway: 'OPENCLAW_GATEWAY_PORT',
};

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

export function requestedRuntimePorts(
  fixedPorts: RuntimePortOverrides
): RequestedRuntimePort[] {
  const requested: RequestedRuntimePort[] = [];
  for (const key of RUNTIME_PORT_KEYS) {
    const port = fixedPorts[key];
    if (port !== undefined) {
      requested.push({ envVar: RUNTIME_PORT_ENV_VARS[key], port });
    }
  }
  return requested;
}

export async function assertRequestedPortsAvailable(
  requestedPorts: readonly RequestedRuntimePort[]
): Promise<void> {
  const envVarByPort = new Map<number, string>();
  for (const { envVar, port } of requestedPorts) {
    const previousEnvVar = envVarByPort.get(port);
    if (previousEnvVar) {
      throw new Error(
        `${envVar}=${port} conflicts with ${previousEnvVar}=${port}`
      );
    }
    envVarByPort.set(port, envVar);
  }

  await Promise.all(
    requestedPorts.map(async ({ envVar, port }) => {
      if (!(await canBindHostPort(port))) {
        throw new Error(`${envVar}=${port} is already in use`);
      }
    })
  );
}

export async function allocateRuntimeEndpoints(
  fixedPorts: RuntimePortOverrides = {}
): Promise<RuntimeEndpoints> {
  const fakeModelPort = fixedPorts.fakeModel ?? (await allocatePort());
  const zodPort = fixedPorts.zod ?? (await allocatePort());
  const tenPort = fixedPorts.ten ?? (await allocatePort());
  const mugPort = fixedPorts.mug ?? (await allocatePort());
  const gatewayPort =
    fixedPorts.gateway === undefined ? undefined : fixedPorts.gateway;

  const endpoints: RuntimeEndpoints = {
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

  if (gatewayPort !== undefined) {
    endpoints.gateway = {
      hostBaseUrl: `http://127.0.0.1:${gatewayPort}`,
      hostPort: gatewayPort,
    };
  }

  return endpoints;
}

async function canBindHostPort(port: number): Promise<boolean> {
  for (const host of ['0.0.0.0', '127.0.0.1']) {
    if (!(await canBindHostPortOnHost(port, host))) {
      return false;
    }
  }
  return true;
}

async function canBindHostPortOnHost(
  port: number,
  host: string
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        resolve(false);
        return;
      }
      reject(error);
    });
    server.listen({ port, host, exclusive: true }, () => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(true);
      });
    });
  });
}
