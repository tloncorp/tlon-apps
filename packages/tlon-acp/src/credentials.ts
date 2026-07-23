import { isAbsolute } from 'node:path';

export function adapterEnvironment(
  base: NodeJS.ProcessEnv,
  adapterHome?: string
): NodeJS.ProcessEnv {
  const env = { ...base };
  if (!adapterHome) return env;
  if (!isAbsolute(adapterHome)) {
    throw new Error('ACP_ADAPTER_HOME must be an absolute path');
  }
  env.HOME = adapterHome;
  return env;
}
