// src/cli-util.ts

/** Bad command-line input; `main` turns it into exit status 2. */
export class UsageError extends Error { override name = 'UsageError'; }

export const has = (args: string[], name: string) => args.includes(name);

/** The value after `name`, or undefined when the flag is absent. A flag followed by nothing or another flag is a usage error. */
export function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  if (v === undefined || v.startsWith('--')) throw new UsageError(`${name} needs a value`);
  return v;
}

/** A string usable as a file name component. */
export const safeName = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, '_');

export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks).toString('utf8');
}
