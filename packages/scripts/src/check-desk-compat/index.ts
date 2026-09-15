#!/usr/bin/env node
import {
  collate,
  diffInventories,
  renderFailure,
  renderMarkdown,
  renderText,
  target,
} from './diff';
import { CLIENT_ROOTS, extractClient } from './extract';
import { WORKTREE_REF, openTree } from './git';

const USAGE = `
Usage: pnpm --filter 'scripts' list:desk-requests [options]
       pnpm check:desk-requests <ref> [--markdown]

  --list                 print every request the client makes of the desk;
                         a row marked ? is one this reader could not resolve
  --diff-base <ref>      print the requests added, changed and removed between
                         <ref> and the client tree
  --client-ref <ref>     client tree to extract from (default: ${WORKTREE_REF})
  --markdown             render the diff as markdown, for a PR comment

Extraction only: this says what the client asks for, not whether any desk
serves it. Roots scanned: ${CLIENT_ROOTS.join(', ')}.
`.trim();

const FLAGS = new Set(['list', 'help', 'markdown']);

function inventory(ref: string) {
  const tree = openTree(ref, CLIENT_ROOTS);
  try {
    return extractClient(tree);
  } finally {
    tree.dispose();
  }
}

function list(clientRef: string): number {
  const listed = collate(inventory(clientRef));
  console.log(`desk requests extracted from ${clientRef}\n`);
  const width = (pick: (r: (typeof listed)[number]) => string) =>
    Math.max(...listed.map((r) => pick(r).length), 0);
  const kindWidth = width((r) => r.dep.surface);
  const appWidth = width((r) => r.dep.app ?? '?');
  for (const row of listed) {
    console.log(
      [
        row.dep.unresolved ? '?' : ' ',
        row.dep.surface.padEnd(kindWidth),
        (row.dep.app ?? '?').padEnd(appWidth),
        target(row.dep),
      ].join(' ')
    );
    // A row this reader could not resolve is still a request the client
    // makes; printing the list without saying so reads like a clean sweep.
    if (row.dep.unresolved)
      console.log(`      unresolved: ${row.dep.unresolved}`);
    console.log(`      ${row.sites.join(', ')}`);
  }
  const unresolved = listed.filter((r) => r.dep.unresolved).length;
  console.log(
    `\n${listed.length} distinct requests from ${listed.reduce((n, r) => n + r.sites.length, 0)} call sites` +
      `, ${unresolved} of them marked ? because this reader could not resolve them`
  );
  return 0;
}

/**
 * Always exits 0. The diff is a worklist for a reviewer, not a verdict: no
 * inventory change is wrong on its face, so nothing here can be a gate.
 */
function diff(baseRef: string, clientRef: string, markdown: boolean): number {
  const refs = { base: baseRef, head: clientRef };
  let result;
  try {
    result = diffInventories(inventory(baseRef), inventory(clientRef));
  } catch (error) {
    console.log(renderFailure((error as Error).message, refs, markdown));
    return 0;
  }
  console.log(
    markdown ? renderMarkdown(result, refs) : renderText(result, refs)
  );
  return 0;
}

function main(): number {
  const args: Record<string, string | boolean> = {};
  const argv = process.argv.slice(2);
  argv.forEach((arg, i) => {
    if (!arg.startsWith('--')) return;
    const name = arg.slice(2);
    args[name] = FLAGS.has(name) ? true : argv[i + 1];
  });

  const diffBase = args['diff-base'];
  if (args.help || (!args.list && typeof diffBase !== 'string')) {
    console.log(USAGE);
    return args.help ? 0 : 2;
  }
  const clientRef =
    typeof args['client-ref'] === 'string' ? args['client-ref'] : WORKTREE_REF;
  return typeof diffBase === 'string'
    ? diff(diffBase, clientRef, args.markdown === true)
    : list(clientRef);
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`desk-requests: ${(error as Error).message}`);
  process.exitCode = 2;
}
