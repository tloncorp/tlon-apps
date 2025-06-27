import { formatUw } from '@urbit/aura';
import { Atom } from '@urbit/nockjs';

import { createDevLogger } from '../debug';
import { request } from './urbit';

const logger = createDevLogger('proxyApi', true);

export async function proxyRequest<T>(
  url: string,
  requestOptions: RequestInit,
  timeout: number = 15_000
): Promise<T> {
  const encodedUrl = formatUw(Atom.fromCord(url).number);
  logger.log('sending proxy request', { url, requestOptions, timeout });
  try {
    const result: T = await request<T>(
      `/apps/groups/~/proxy/${encodedUrl}`,
      requestOptions,
      timeout
    );
    return result;
  } catch (e) {
    console.log('bl: proxy request failed', e);
    throw new Error('Proxy request failed: ' + e);
  }
}
