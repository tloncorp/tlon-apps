// src/prompt.ts
import { createInterface } from 'node:readline';
import { readStdin } from './cli-util';

const ended = (flagName?: string) => new Error(`input ended; pass ${flagName ?? 'the --flag'} instead`);

/** Rejects when stdin closes before an answer, so a non-interactive run fails instead of hanging or guessing. */
export function ask(q: string, def = '', flagName?: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res, rej) => {
    let answered = false;
    rl.on('close', () => { if (!answered) rej(ended(flagName)); });
    rl.question(def ? `${q} [${def}] ` : `${q} `, (a) => { answered = true; rl.close(); res(a.trim() || def); });
  });
}
export async function confirm(q: string, def = true, flagName?: string): Promise<boolean> {
  const a = (await ask(`${q} ${def ? '[Y/n]' : '[y/N]'}`, '', flagName)).toLowerCase();
  return a === '' ? def : a.startsWith('y');
}

/** Apply raw TTY input to a hidden line: backspace (DEL or ^H) edits, escape sequences (arrow keys etc.) are dropped. */
export function editHidden(s: string, input: string, esc = 0): { s: string; done: boolean; esc: number } {
  for (const c of input) {
    if (esc === 1) { esc = c === '[' ? 2 : 0; continue; }
    if (esc === 2) { if (c >= '@' && c <= '~') esc = 0; continue; }
    if (c === '\u001b') { esc = 1; continue; }
    if (c === '\n' || c === '\r' || c === '\u0004') return { s, done: true, esc: 0 };
    if (c === '\u007f' || c === '\b') s = s.slice(0, -1);
    else if (c >= ' ') s += c;
  }
  return { s, done: false, esc };
}

/** Hidden input (no echo). Falls back to plain `ask` when stdin is not a TTY. */
export async function askHidden(q: string, flagName?: string): Promise<string> {
  if (!process.stdin.isTTY) return ask(q, '', flagName);
  process.stdout.write(q + ' ');
  process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding('utf8');
  return new Promise((res) => {
    let st = { s: '', done: false, esc: 0 };
    const on = (ch: string) => {
      if (ch.includes('\u0003')) { process.stdin.setRawMode(false); process.stdout.write('\n'); process.exit(130); }
      st = editHidden(st.s, ch, st.esc);
      if (!st.done) return;
      process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.off('data', on); process.stdout.write('\n'); res(st.s);
    };
    process.stdin.on('data', on);
  });
}

/** A secret from `--…-stdin`: the first line of piped input, or a hidden prompt when stdin is a terminal
 *  (so the secret is not echoed and no Ctrl-D is needed). */
export async function readSecret(q: string, flagName: string): Promise<string> {
  if (process.stdin.isTTY) return askHidden(q, flagName);
  return (await readStdin()).split('\n')[0].trim();
}
