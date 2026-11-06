// src/paths.ts
import { mkdirSync, writeFileSync, chmodSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export class Paths {
  constructor(public readonly root = process.env.TLON_MEMORY_HOME ?? join(homedir(), '.tlon', 'memory')) {}
  get configFile() { return join(this.root, 'config.json'); }
  get stateDir() { return join(this.root, 'state'); }
  get queueDir() { return join(this.root, 'queue'); }
  get logFile() { return join(this.root, 'log'); }
  ensure() {
    for (const d of [this.root, this.stateDir, this.queueDir]) {
      if (!existsSync(d)) mkdirSync(d, { recursive: true, mode: 0o700 });
    }
  }
}

/** Write a file readable only by the user, atomically (tmp + rename). */
export function writePrivate(file: string, data: string) {
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, data, { mode: 0o600 });
  chmodSync(tmp, 0o600);
  // rename is atomic on the same filesystem
  require('node:fs').renameSync(tmp, file);
}
