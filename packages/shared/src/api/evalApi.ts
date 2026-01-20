import { poke, scry, thread } from './urbit';

export interface EvalResult {
  status: 'ok' | 'error';
  output: string;
}

/**
 * Evaluate Hoon code via the eval spider thread.
 * The code runs in a sandboxed environment with no scry access.
 *
 * @param code - The Hoon code to evaluate
 * @returns The evaluation result with status and output
 */
export async function evalHoon(code: string): Promise<EvalResult> {
  const result = await thread<string, EvalResult>({
    inputMark: 'hoon',
    outputMark: 'eval-output',
    threadName: 'eval',
    body: code,
    desk: 'groups',
  });

  return result;
}
