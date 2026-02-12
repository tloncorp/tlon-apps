import {
  PokeParams,
  UrbitTestOverrides,
  internalSetUrbitTestOverrides,
} from '@tloncorp/api';
import { vi } from 'vitest';

export const scryMock = vi.fn();
export const pokeMock = vi.fn();
export const trackedPokeMock = vi.fn();
export const currentUserIdMock = vi.fn(() => '~solfer-magfed');

export function installUrbitTestMocks() {
  const overrides: UrbitTestOverrides = {
    scry: async (params) => scryMock(params),
    poke: async (params: PokeParams) => pokeMock(params),
    trackedPoke: async (params, endpoint, predicate, requestConfig) => {
      await trackedPokeMock(params, endpoint, predicate, requestConfig);
    },
    getCurrentUserId: () => currentUserIdMock(),
  };
  internalSetUrbitTestOverrides(overrides);
}

export function resetUrbitTestMocks() {
  scryMock.mockReset();
  pokeMock.mockReset();
  trackedPokeMock.mockReset();
  currentUserIdMock.mockReset();
  currentUserIdMock.mockReturnValue('~solfer-magfed');
}
