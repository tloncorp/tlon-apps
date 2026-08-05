import net from 'node:net';
import { afterEach, describe, expect, test } from 'vitest';

import {
  FAKEZOD_ACCESS_CODES,
  allocatePort,
  allocateRuntimeEndpoints,
  assertRequestedPortsAvailable,
  requestedRuntimeEndpointPorts,
  requestedRuntimePorts,
} from './ports.js';

describe('runtime endpoint allocation', () => {
  const occupiedServers: net.Server[] = [];

  afterEach(async () => {
    await Promise.all(occupiedServers.splice(0).map(closeServer));
  });

  test('preserves fakezod access codes and explicit host/container endpoints', async () => {
    const endpoints = await allocateRuntimeEndpoints({
      fakeModel: 4100,
      zod: 4101,
      ten: 4102,
      mug: 4103,
    });

    expect(endpoints.fakeModel.containerOpenAiBaseUrl).toBe(
      'http://fake-model:4000/v1'
    );
    expect(endpoints.fakeModel.hostOpenAiBaseUrl).toBe(
      'http://127.0.0.1:4100/v1'
    );
    expect(endpoints.ships.zod).toMatchObject({
      ship: '~zod',
      code: FAKEZOD_ACCESS_CODES.zod,
      containerUrl: 'http://ships:8080',
      hostUrl: 'http://127.0.0.1:4101',
    });
    expect(endpoints.ships.ten.code).toBe(FAKEZOD_ACCESS_CODES.ten);
    expect(endpoints.ships.mug.code).toBe(FAKEZOD_ACCESS_CODES.mug);
    expect(endpoints.gateway).toBeUndefined();
  });

  test('allocates optional driver-owned gateway endpoint when requested', async () => {
    const endpoints = await allocateRuntimeEndpoints({
      fakeModel: 4100,
      zod: 4101,
      ten: 4102,
      mug: 4103,
      gateway: 4104,
    });

    expect(endpoints.gateway).toEqual({
      hostBaseUrl: 'http://127.0.0.1:4104',
      hostPort: 4104,
    });
  });

  test('maps fixed runtime port overrides to env-var-labelled requests', () => {
    expect(
      requestedRuntimePorts({
        fakeModel: 4100,
        zod: 4101,
        gateway: 4104,
      })
    ).toEqual([
      { envVar: 'FAKE_MODEL_PORT', port: 4100 },
      { envVar: 'ZOD_PORT', port: 4101 },
      { envVar: 'OPENCLAW_GATEWAY_PORT', port: 4104 },
    ]);
  });

  test('maps final runtime endpoints to env-var-labelled port requests', async () => {
    const endpoints = await allocateRuntimeEndpoints({
      fakeModel: 4100,
      zod: 4101,
      ten: 4102,
      mug: 4103,
      gateway: 4104,
    });

    expect(requestedRuntimeEndpointPorts(endpoints)).toEqual([
      { envVar: 'FAKE_MODEL_PORT', port: 4100 },
      { envVar: 'ZOD_PORT', port: 4101 },
      { envVar: 'TEN_PORT', port: 4102 },
      { envVar: 'MUG_PORT', port: 4103 },
      { envVar: 'OPENCLAW_GATEWAY_PORT', port: 4104 },
    ]);
  });

  test('accepts requested fixed ports that are available', async () => {
    const port = await allocatePort();

    await expect(
      assertRequestedPortsAvailable([{ envVar: 'TEN_PORT', port }])
    ).resolves.toBeUndefined();
  });

  test('fails with the env var name when a requested fixed port is occupied', async () => {
    const port = await occupyLocalhostPort();

    await expect(
      assertRequestedPortsAvailable([{ envVar: 'FAKE_MODEL_PORT', port }])
    ).rejects.toThrow(`FAKE_MODEL_PORT=${port} is already in use`);
  });

  test('fails early when two fixed overrides request the same port', async () => {
    await expect(
      assertRequestedPortsAvailable([
        { envVar: 'ZOD_PORT', port: 4101 },
        { envVar: 'TEN_PORT', port: 4101 },
      ])
    ).rejects.toThrow('TEN_PORT=4101 conflicts with ZOD_PORT=4101');
  });

  test('fails early when two final endpoints request the same host port', async () => {
    const endpoints = await allocateRuntimeEndpoints({
      fakeModel: 4100,
      zod: 4101,
      ten: 4101,
      mug: 4103,
    });

    await expect(
      assertRequestedPortsAvailable(requestedRuntimeEndpointPorts(endpoints))
    ).rejects.toThrow('TEN_PORT=4101 conflicts with ZOD_PORT=4101');
  });

  test('fails with the env var name when a final endpoint port is occupied', async () => {
    const port = await occupyLocalhostPort();
    const endpoints = await allocateRuntimeEndpoints({
      fakeModel: port,
      zod: 4101,
      ten: 4102,
      mug: 4103,
    });

    await expect(
      assertRequestedPortsAvailable(requestedRuntimeEndpointPorts(endpoints))
    ).rejects.toThrow(`FAKE_MODEL_PORT=${port} is already in use`);
  });

  async function occupyLocalhostPort(): Promise<number> {
    const server = await new Promise<net.Server>((resolve, reject) => {
      const nextServer = net.createServer();
      nextServer.once('error', reject);
      nextServer.listen(0, '127.0.0.1', () => {
        nextServer.off('error', reject);
        resolve(nextServer);
      });
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      await closeServer(server);
      throw new Error('failed to occupy TCP port');
    }

    occupiedServers.push(server);
    return address.port;
  }

  async function closeServer(server: net.Server): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
});
