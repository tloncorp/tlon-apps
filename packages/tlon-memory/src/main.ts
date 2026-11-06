// src/main.ts
import { VERSION } from './version';

export const USAGE = `Usage: tlon-memory <command>

  setup [--ship-url U --api-key-stdin --notebook T --scope DIR --clients claude,codex --yes --no-tool-io]
  status
  pause | resume
  scope add|remove|list [DIR]
  sync
  export [--out DIR]
  delete --session ID | --memory ID | --all
  disconnect [--revoke-key]
  hook <claude|codex>     (called by client hooks; reads JSON on stdin)
  mcp                     (stdio MCP server)
`;

export async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  if (cmd === '--version' || cmd === '-v') {
    console.log(`tlon-memory ${VERSION}`);
    return 0;
  }
  switch (cmd) {
    case 'setup': return (await import('./setup')).setup(rest);
    case 'hook': return (await import('./hook')).hook(rest);
    case 'mcp': return (await import('./mcp')).serve();
    case 'status': case 'pause': case 'resume': case 'scope': case 'sync':
    case 'export': case 'delete': case 'disconnect':
      return (await import('./commands')).command(cmd, rest);
    default:
      process.stderr.write(USAGE);
      return 2;
  }
}

if (import.meta.main) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => {
    process.stderr.write(`tlon-memory: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  });
}
