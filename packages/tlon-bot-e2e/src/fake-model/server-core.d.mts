import type { Server } from 'node:http';

export interface FakeModelServerListenOptions {
  port?: number;
  host?: string;
}

export interface FakeModelServerListener {
  baseUrl: string;
  port: number;
  close(): Promise<void>;
}

export interface FakeModelServerController {
  server: Server;
  listen(
    options?: FakeModelServerListenOptions
  ): Promise<FakeModelServerListener>;
  close(): Promise<void>;
}

export interface AdvertisedToolMetadata {
  toolNames: string[];
  toolCount: number;
  toolChoice: unknown | null;
}

export function createFakeModelServer(): FakeModelServerController;
export function extractAdvertisedToolMetadata(
  body: unknown
): AdvertisedToolMetadata;
