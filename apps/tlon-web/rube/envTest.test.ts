import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { envTestPathFor, loadEnvTest } from './envTest';

describe('loadEnvTest', () => {
  let root: string;
  let rubeDir: string;
  let saved: NodeJS.ProcessEnv;

  const writeEnvTest = (contents: string) => {
    fs.writeFileSync(envTestPathFor(rubeDir), contents);
  };

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'env-test-'));
    // envTestPathFor climbs two levels, mirroring rube/ inside apps/tlon-web/.
    rubeDir = path.join(root, 'app', 'rube');
    fs.mkdirSync(rubeDir, { recursive: true });
    saved = { ...process.env };
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    for (const key of Object.keys(process.env)) {
      if (!(key in saved)) delete process.env[key];
    }
    Object.assign(process.env, saved);
  });

  it('does nothing when there is no .env.test', () => {
    delete process.env.N1_SHIP;
    loadEnvTest(rubeDir);
    expect(process.env.N1_SHIP).toBeUndefined();
  });

  it('strips quotes, so a quoted ship name still names the ship', () => {
    // The hand-rolled split('=') this replaced kept the quotes, and
    // shouldIncludeShip then compared '"bud"' with 'bud' and found no match —
    // in one entrypoint but not the others.
    delete process.env.N1_SHIP;
    writeEnvTest('N1_SHIP="bud"\n');
    loadEnvTest(rubeDir);
    expect(process.env.N1_SHIP).toBe('bud');
  });

  it('strips a trailing comment', () => {
    delete process.env.N1_SHIP;
    writeEnvTest('N1_SHIP=bud # the pinned N-1 pier\n');
    loadEnvTest(rubeDir);
    expect(process.env.N1_SHIP).toBe('bud');
  });

  it('does not override a variable already set', () => {
    process.env.N1_SHIP = 'wes';
    writeEnvTest('N1_SHIP=bud\n');
    loadEnvTest(rubeDir);
    expect(process.env.N1_SHIP).toBe('wes');
  });

  it('does not override a variable explicitly set to empty', () => {
    // `FOO=` in the environment means "off"; the file must not switch it on.
    process.env.INCLUDE_OPTIONAL_SHIPS = '';
    writeEnvTest('INCLUDE_OPTIONAL_SHIPS=true\n');
    loadEnvTest(rubeDir);
    expect(process.env.INCLUDE_OPTIONAL_SHIPS).toBe('');
  });

  it('skips comments and blank lines', () => {
    delete process.env.N1_SHIP;
    delete process.env.INCLUDE_OPTIONAL_SHIPS;
    writeEnvTest('# a comment\n\nN1_SHIP=bud\n');
    loadEnvTest(rubeDir);
    expect(process.env.N1_SHIP).toBe('bud');
    expect(process.env.INCLUDE_OPTIONAL_SHIPS).toBeUndefined();
  });
});
