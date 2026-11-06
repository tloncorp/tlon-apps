// src/prompt.ts
import { createInterface } from 'node:readline';

export async function ask(q: string, def = ''): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try { const a = await new Promise<string>((res) => rl.question(def ? `${q} [${def}] ` : `${q} `, res)); return a.trim() || def; }
  finally { rl.close(); }
}
export async function confirm(q: string, def = true): Promise<boolean> {
  const a = (await ask(`${q} ${def ? '[Y/n]' : '[y/N]'}`)).toLowerCase();
  return a === '' ? def : a.startsWith('y');
}
/** Hidden input (no echo). Falls back to plain `ask` when stdin is not a TTY. */
export async function askHidden(q: string): Promise<string> {
  if (!process.stdin.isTTY) return ask(q);
  process.stdout.write(q + ' ');
  process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding('utf8');
  return new Promise((res) => { let s = ''; const on = (ch: string) => { for (const c of ch) {
    if (c === '\n' || c === '\r' || c === '\u0004') { process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.off('data', on); process.stdout.write('\n'); res(s); return; }
    if (c === '\u0003') { process.stdout.write('\n'); process.exit(130); }
    if (c === '\u007f') s = s.slice(0, -1); else s += c; } }; process.stdin.on('data', on); });
}
export async function readLineFromStdin(): Promise<string> {
  const chunks: Buffer[] = []; for await (const c of process.stdin) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks).toString('utf8').split('\n')[0].trim();
}
