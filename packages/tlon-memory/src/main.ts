// src/main.ts
import { UsageError } from './cli-util';
import { VERSION } from './version';

export const USAGE = `Usage: tlon-memory <command>

  setup [options]           connect a ship, create the notebook, wire up clients
      --ship-url URL          ship URL (https; http only for localhost); a copied browser URL is fine
      --api-key-stdin         read the Notes API key from stdin (hidden prompt on a terminal)
      --code-stdin            read your +code from stdin to fetch the key (hidden prompt on a terminal)
      --new-account           print the sign-up link and stop
      --reconnect             replace the key (and with --ship-url, the URL); keeps notebook, scopes, clients
      --notebook TITLE        notebook title (default "Agent Memory")
      --scope DIR|none        directory whose sessions are captured (required with --yes)
      --force-scope           allow home, / or a parent of home as the scope
      --clients LIST          claude,codex | claude | codex | none
      --no-tool-io            do not upload tool inputs/outputs
      --yes                   no prompts; missing required flags are errors
  status
  pause | resume
  scope add DIR [--force-scope] | scope remove DIR | scope list
  sync
  import <transcript.jsonl>  upload one conversation (Claude Code or Codex)
  import --session claude-code:ID|codex:ID
  import --all [--dry-run]  every conversation whose directory is in scope
  export [--out DIR]        default ~/tlon-memory-export-<date>
  delete --session claude-code:ID|codex:ID | --memory ID | --all  [--yes]
  disconnect [--revoke-key]
  hook <claude|codex>       (called by client hooks; reads JSON on stdin)
  mcp                       (stdio MCP server)
`;

export async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  if (cmd === '--version' || cmd === '-v') {
    console.log(`tlon-memory ${VERSION}`);
    return 0;
  }
  if (cmd === '--help' || cmd === '-h' || cmd === 'help') {
    process.stdout.write(USAGE);
    return 0;
  }
  try {
    switch (cmd) {
      case 'setup': return await (await import('./setup')).setup(rest);
      case 'hook': return await (await import('./hook')).hook(rest);
      case 'mcp': return await (await import('./mcp')).serve();
      case 'status': case 'pause': case 'resume': case 'scope': case 'sync':
      case 'export': case 'delete': case 'disconnect': case 'import':
        return await (await import('./commands')).command(cmd, rest);
      default:
        process.stderr.write(USAGE);
        return 2;
    }
  } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    process.stderr.write(`tlon-memory: ${e.message}\n`);
    return 2;
  }
}

if (import.meta.main) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => {
    process.stderr.write(`tlon-memory: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  });
}
