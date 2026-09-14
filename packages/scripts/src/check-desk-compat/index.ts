#!/usr/bin/env node
import { exitCodeFor, formatReport, markdownReport, runCheck } from './check';
import { CLIENT_ROOTS, Dependency, extractClient } from './extract';
import { WORKTREE_REF, openTree } from './git';

const USAGE = `
Usage: pnpm check:desk-compat [options]

  --client-ref <ref>     client tree to extract from (default: ${WORKTREE_REF})
  --desk-ref <ref>       desk tree to check against (required unless --list)
  --base-ref <ref>       client this change is measured against. A known-gaps
                         entry only excuses a request that was already made,
                         and already missing, there. Omit it locally; a gate
                         run must pass one.
  --json                 emit the report as JSON
  --markdown             emit the report as markdown, for a PR comment
  --list                 list every extracted request and exit; no desk is read

Exit codes: 0 = nothing MISSING, 1 = one or more MISSING (or a negotiation
protocol difference), 2 = internal error.

The three release-time runs (docs/tlon-apps/desk-compatibility.md):
  --client-ref <candidate>     --desk-ref v<N-1>        rule (b)
  --client-ref <candidate>     --desk-ref <candidate>   self-consistency
  --client-ref origin/master   --desk-ref <candidate>   rule (c), removal
`.trim();

const at = (d: Dependency) => `${d.site.file}:${d.site.line}`;
const target = (d: Dependency) =>
  d.mark ?? d.thread ?? d.path?.shape ?? d.path?.text ?? '?';

/** `--list`: extraction only, so the reader can see what the client asks for. */
function list(clientRef: string): number {
  const tree = openTree(clientRef, CLIENT_ROOTS);
  try {
    const rows = new Map<string, { dep: Dependency; sites: string[] }>();
    for (const dep of extractClient(tree)) {
      const row = rows.get(dep.key);
      if (row) {
        if (!row.sites.includes(at(dep))) row.sites.push(at(dep));
      } else rows.set(dep.key, { dep, sites: [at(dep)] });
    }
    const listed = [...rows.values()].sort((a, b) =>
      a.dep.key.localeCompare(b.dep.key)
    );
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

function main(): number {
  const flags = new Set(['json', 'markdown', 'list', 'help']);
  const args: Record<string, string | boolean> = {};
  const argv = process.argv.slice(2);
  argv.forEach((arg, i) => {
    if (!arg.startsWith('--')) return;
    const name = arg.slice(2);
    args[name] = flags.has(name) ? true : argv[i + 1];
  });

  if (args.help) {
    console.log(USAGE);
    return 0;
  }
  const clientRef =
    typeof args['client-ref'] === 'string' ? args['client-ref'] : WORKTREE_REF;
  if (args.list) return list(clientRef);

  const deskRef = args['desk-ref'];
  if (typeof deskRef !== 'string' || deskRef.length === 0) {
    console.error(`error: --desk-ref is required\n\n${USAGE}`);
    return 2;
  }
  const baseRef = args['base-ref'];
  const report = runCheck({
    clientRef,
    deskRef,
    ...(typeof baseRef === 'string' && baseRef.length > 0 ? { baseRef } : {}),
  });
  console.log(
    args.json
      ? JSON.stringify(report, null, 2)
      : args.markdown
        ? markdownReport(report)
        : formatReport(report)
  );
  return exitCodeFor(report);
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`desk-compat: ${(error as Error).message}`);
  process.exitCode = 2;
}
