import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Repacking replaces Expo metadata and JS. Ignore only the displayed source label;
// every native input and all other Expo configuration must still match.
export function nativeKey(fingerprint) {
  if (!fingerprint?.sources?.length)
    throw new Error('Missing native fingerprint sources');
  let configSeen = false;
  const rows = fingerprint.sources
    .map((source) => {
      const key = source.filePath || source.id;
      if (!key || !source.hash)
        throw new Error('Incomplete native fingerprint');
      let hash = source.hash;
      if (source.id === 'expoConfig') {
        const config = JSON.parse(source.contents);
        if (config.ios?.bundleIdentifier !== 'io.tlon.groups')
          throw new Error('Fingerprint was not computed with the e2e profile');
        delete config.extra.gitHash;
        hash = createHash('sha256')
          .update(JSON.stringify(config))
          .digest('hex');
        configSeen = true;
      }
      return [source.type, key, hash];
    })
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (!configSeen || new Set(rows.map((r) => r[1])).size !== rows.length)
    throw new Error('Ambiguous native fingerprint');
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}

async function main() {
  const fingerprint = process.env.QA_NATIVE_FINGERPRINT;
  if (!/^[a-f0-9]{40}$/.test(fingerprint || ''))
    throw new Error('Missing current native fingerprint');
  const dir = path.resolve('.qa-native-query');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'qa-native-query', private: true })
  );
  writeFileSync(
    path.join(dir, 'app.json'),
    JSON.stringify({
      expo: {
        name: 'Tlon',
        slug: 'groups',
        owner: 'tlon',
        extra: { eas: { projectId: '617bb643-5bf6-4c40-8af6-c6e9dd7e3bd0' } },
      },
    })
  );
  const eas = (args) =>
    JSON.parse(
      execFileSync(
        'npx',
        ['--yes', 'eas-cli@23.2.0', ...args, '--json', '--non-interactive'],
        {
          cwd: dir,
          encoding: 'utf8',
          timeout: 120000,
          maxBuffer: 16 * 1024 * 1024,
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      )
    );
  const builds = eas([
    'build:list',
    '--platform',
    'ios',
    '--build-profile',
    'e2e',
    '--simulator',
    '--status',
    'finished',
    '--limit',
    '8',
  ]);
  for (const build of builds) {
    if (!build.fingerprint?.hash) continue;
    const compared = eas([
      'fingerprint:compare',
      fingerprint,
      build.fingerprint.hash,
    ]);
    if (nativeKey(compared.fingerprint1) !== nativeKey(compared.fingerprint2))
      continue;
    writeFileSync('/tmp/qa-compatible-build', build.id);
    console.log(
      `Compatible native build ${build.id}; current JavaScript and Expo metadata must be repacked.`
    );
    return;
  }
  writeFileSync('/tmp/qa-compatible-build', '');
  console.log('No compatible native build in the latest eight e2e builds.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
