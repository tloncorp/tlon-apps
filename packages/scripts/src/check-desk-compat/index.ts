#!/usr/bin/env node
import { CLIENT_ROOTS, Dependency, extractClient } from './extract';
import { WORKTREE_REF, openTree } from './git';

const USAGE = `
Usage: pnpm --filter 'scripts' list:desk-requests [options]

  --list                 print every request the client makes of the desk
  --client-ref <ref>     client tree to extract from (default: ${WORKTREE_REF})

Extraction only: this says what the client asks for, not whether any desk
serves it. Roots scanned: ${CLIENT_ROOTS.join(', ')}.
`.trim();

const at = (d: Dependency) => `${d.site.file}:${d.site.line}`;

/** One row per request, with every site that makes it. */
function rows(deps: Dependency[]) {
  const byKey = new Map<string, { dep: Dependency; sites: string[] }>();
  for (const dep of deps) {
    const row = byKey.get(dep.key);
    if (row) {
      if (!row.sites.includes(at(dep))) row.sites.push(at(dep));
    } else {
      byKey.set(dep.key, { dep, sites: [at(dep)] });
    }
  }
  return [...byKey.values()].sort((a, b) => a.dep.key.localeCompare(b.dep.key));
}

const target = (d: Dependency) =>
  d.mark ?? d.thread ?? d.path?.shape ?? d.path?.text ?? '?';

function main(): number {
  const args: Record<string, string | boolean> = {};
  const argv = process.argv.slice(2);
  argv.forEach((arg, i) => {
    if (!arg.startsWith('--')) return;
    const name = arg.slice(2);
    args[name] = name === 'list' || name === 'help' ? true : argv[i + 1];
  });

  if (args.help || !args.list) {
    console.log(USAGE);
    return args.help ? 0 : 2;
  }
  const clientRef =
    typeof args['client-ref'] === 'string' ? args['client-ref'] : WORKTREE_REF;
  const tree = openTree(clientRef, CLIENT_ROOTS);
  try {
    const listed = rows(extractClient(tree));
    console.log(`desk requests extracted from ${clientRef}\n`);
    const width = (pick: (r: (typeof listed)[number]) => string) =>
      Math.max(...listed.map((r) => pick(r).length), 0);
    const kindWidth = width((r) => r.dep.surface);
    const appWidth = width((r) => r.dep.app ?? '?');
    for (const row of listed) {
      console.log(
        [
          row.dep.surface.padEnd(kindWidth),
          (row.dep.app ?? '?').padEnd(appWidth),
          target(row.dep),
        ].join('  ')
      );
      console.log(`    ${row.sites.join(', ')}`);
    }
    console.log(
      `\n${listed.length} distinct requests from ${listed.reduce((n, r) => n + r.sites.length, 0)} call sites`
    );
    return 0;
  } finally {
    tree.dispose();
  }
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`desk-requests: ${(error as Error).message}`);
  process.exitCode = 2;
}
