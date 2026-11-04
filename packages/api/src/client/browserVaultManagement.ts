import {
  browserOwnerRequest,
  browserOwnerServiceOrigin,
} from './browserOwnerSession';

export interface VaultField {
  name: string;
  label?: string;
  type: 'text' | 'email' | 'password';
  sensitive: boolean;
  hasValue: boolean;
}
export interface VaultLogin {
  key: string;
  id: string;
  revision: number;
  origins: string[];
  fields: VaultField[];
}
export interface VaultLoginDetail extends Omit<VaultLogin, 'fields'> {
  fields: (VaultField & { value?: string })[];
}

function endpoint(key?: string) {
  return `${browserOwnerServiceOrigin()}/owner/credentials${key === undefined ? '' : `/${encodeURIComponent(key)}`}`;
}

export async function listVaultLogins(
  botMoon: string,
  signal?: AbortSignal
): Promise<VaultLogin[]> {
  const result = (await browserOwnerRequest(
    endpoint(),
    botMoon,
    'GET',
    undefined,
    signal
  )) as { credentials: VaultLogin[] };
  return result.credentials;
}
export async function getVaultLogin(
  botMoon: string,
  key: string,
  signal?: AbortSignal
): Promise<VaultLoginDetail> {
  return (await browserOwnerRequest(
    endpoint(key),
    botMoon,
    'GET',
    undefined,
    signal
  )) as VaultLoginDetail;
}
export async function removeVaultLogin(
  botMoon: string,
  key: string
): Promise<void> {
  await browserOwnerRequest(endpoint(key), botMoon, 'DELETE');
}
