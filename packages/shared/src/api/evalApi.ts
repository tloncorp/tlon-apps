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
  const response = await thread<string>({
    inputMark: 'eval-input',
    outputMark: 'eval-output',
    threadName: 'eval',
    body: code,
    desk: 'groups',
  });

  if (!response.ok) {
    throw new Error(`Eval request failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result as EvalResult;
}
