import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface SessionStore {
  load(): Promise<Record<string, string>>;
  save(sessions: Record<string, string>): Promise<void>;
}

export class MemorySessionStore implements SessionStore {
  constructor(private sessions: Record<string, string> = {}) {}

  async load(): Promise<Record<string, string>> {
    return { ...this.sessions };
  }

  async save(sessions: Record<string, string>): Promise<void> {
    this.sessions = { ...sessions };
  }
}

export class FileSessionStore implements SessionStore {
  constructor(private readonly path: string) {}

  async load(): Promise<Record<string, string>> {
    try {
      return validateSessions(JSON.parse(await readFile(this.path, 'utf8')));
    } catch (error) {
      if (isNotFound(error)) return {};
      throw error;
    }
  }

  async save(sessions: Record<string, string>): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporary = `${this.path}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(sessions, null, 2)}\n`, {
      mode: 0o600,
    });
    await rename(temporary, this.path);
  }
}

function validateSessions(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('ACP session store must contain an object');
  }
  const sessions: Record<string, string> = {};
  for (const [key, sessionId] of Object.entries(value)) {
    if (typeof sessionId !== 'string' || !sessionId) {
      throw new Error(`Invalid ACP session id for ${key}`);
    }
    sessions[key] = sessionId;
  }
  return sessions;
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}
