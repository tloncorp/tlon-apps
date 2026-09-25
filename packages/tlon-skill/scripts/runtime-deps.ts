// Pieces every command runtime needs and that only a runtime may touch.
//
// These cannot live in commands/command.ts, which is where the command half
// of each command imports its helpers from: command-contract.test.ts forbids
// process globals in any file under commands/, so the runtime side needs a
// home of its own.

/** The CommandDeps output half, written to this process's streams. */
export function createProcessCommandDeps() {
  return {
    stdout: (text: string) => process.stdout.write(text),
    stderr: (text: string) => process.stderr.write(text),
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
