#!/usr/bin/env node
import { exitCodeFor, formatReport, runCheck } from './check';
import { WORKTREE_REF } from './git';

const USAGE = `
Usage: pnpm check:desk-compat [options]

  --client-ref <ref>     client tree to extract from (default: ${WORKTREE_REF})
  --desk-ref <ref>       desk tree to check against (required)
  --json                 emit the report as JSON instead of text

Exit codes: 0 = no MISSING, 1 = one or more MISSING (or a negotiation protocol
difference), 2 = internal error.

The three release-time runs (docs/tlon-apps/desk-compatibility.md):
  --client-ref <candidate>     --desk-ref v<N-1>        rule (b)
  --client-ref <candidate>     --desk-ref <candidate>   self-consistency
  --client-ref origin/master   --desk-ref <candidate>   rule (c), removal
`.trim();

function main(): number {
  const args: Record<string, string | boolean> = {};
  const argv = process.argv.slice(2);
  argv.forEach((arg, i) => {
    if (!arg.startsWith('--')) return;
    const name = arg.slice(2);
    args[name] = name === 'json' || name === 'help' ? true : argv[i + 1];
  });

  if (args.help) {
    console.log(USAGE);
    return 0;
  }
  const deskRef = args['desk-ref'];
  if (typeof deskRef !== 'string' || deskRef.length === 0) {
    console.error(`error: --desk-ref is required\n\n${USAGE}`);
    return 2;
  }
  const clientRef = args['client-ref'];
  const report = runCheck({
    clientRef: typeof clientRef === 'string' ? clientRef : WORKTREE_REF,
    deskRef,
  });
  console.log(
    args.json ? JSON.stringify(report, null, 2) : formatReport(report)
  );
  return exitCodeFor(report);
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`desk-compat: ${(error as Error).message}`);
  process.exitCode = 2;
}
