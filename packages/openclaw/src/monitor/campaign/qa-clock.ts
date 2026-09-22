import { readFileSync } from 'node:fs';

const MAX_OFFSET_MS = 8 * 24 * 60 * 60 * 1000;
const LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'ships',
  'host.docker.internal',
]);

export function createOnboardingQaClock(options: {
  mode?: string;
  accountUrl: string;
  clockFile?: string;
  baseNow?: () => number;
  readFile?: (file: string) => string;
  error?: (error: unknown) => void;
}): (() => number) | undefined {
  if (options.mode !== 'onboarding' || !options.clockFile) return undefined;

  let hostname: string;
  try {
    hostname = new URL(options.accountUrl).hostname;
  } catch {
    return undefined;
  }
  if (!LOCAL_HOSTS.has(hostname)) return undefined;

  const baseNow = options.baseNow ?? Date.now;
  const readFile = options.readFile ?? ((file) => readFileSync(file, 'utf8'));
  return () => {
    const realNow = baseNow();
    try {
      const raw = readFile(options.clockFile!).trim();
      const offset = Number(raw);
      if (!Number.isFinite(offset) || Math.abs(offset) > MAX_OFFSET_MS)
        throw new Error('Onboarding QA clock offset is invalid or out of range');
      return realNow + offset;
    } catch (error) {
      options.error?.(error);
      return realNow;
    }
  };
}
