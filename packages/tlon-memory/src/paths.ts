// src/paths.ts
import { mkdirSync, writeFileSync, chmodSync, existsSync, renameSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export class Paths {
  constructor(public readonly root = process.env.TLON_MEMORY_HOME ?? join(homedir(), '.tlon', 'memory')) {}
  get configFile() { return join(this.root, 'config.json'); }
  get stateDir() { return join(this.root, 'state'); }
  get connectionFile() { return join(this.stateDir, 'connection.json'); }
  /** Present once this state dir has been through a sync or setup; absent means local state may have been lost. */
  get initializedMarker() { return join(this.stateDir, '.initialized'); }
  get queueDir() { return join(this.root, 'queue'); }
  get queueLock() { return join(this.queueDir, '.lock'); }
  get logFile() { return join(this.root, 'log'); }
  ensure() {
    for (const d of [this.root, this.stateDir, this.queueDir]) {
      if (!existsSync(d)) mkdirSync(d, { recursive: true, mode: 0o700 });
    }
  }
}

/** Replace `file` atomically (tmp + rename in the same directory) with the given mode. */
export function writeAtomic(file: string, data: string, mode: number) {
  const tmp = `${file}.tmp-${process.pid}`;
  try {
    writeFileSync(tmp, data, { mode });
    chmodSync(tmp, mode); // the create mode is masked by umask
    renameSync(tmp, file); // atomic on the same filesystem
  } catch (e) { rmSync(tmp, { force: true }); throw e; }
}

/** Write a file readable only by the user, atomically. */
export function writePrivate(file: string, data: string) { writeAtomic(file, data, 0o600); }
