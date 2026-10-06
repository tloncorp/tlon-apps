import {
  BucketsActionFailed,
  type BucketsFlag,
  sendBucketsAction,
} from '@tloncorp/api';

/**
 * The error a row carries when its bytes are up but the answer to
 * finish-upload never arrived. The host may have published the file, so the
 * row says so rather than claiming the upload failed.
 */
export const FINISH_UNCONFIRMED =
  'Uploaded, but the host has not confirmed it yet';

/**
 * Whether a finish-upload failure means the file was not published.
 *
 * Only a typed refusal says so, and not every typed refusal: `unknown` is
 * also what this ship answers when a Bucket's host never replied, and what
 * the host answers for a storage failure it cannot classify. Either way the
 * outcome is unknown, so the row keeps its finish id rather than starting
 * over and uploading a second copy.
 */
export function isFinishRefusal(cause: unknown) {
  return cause instanceof BucketsActionFailed && cause.type !== 'unknown';
}

type FinishOptions = {
  attempts?: number;
  backoffMs?: number;
  send?: typeof sendBucketsAction;
  sleep?: (milliseconds: number) => Promise<unknown>;
};

/**
 * Send finish-upload, re-asking under the same request id if the answer is
 * lost.
 *
 * The host holds this request open while it verifies the receipt with
 * storage, which makes it the likeliest place for an answer to go missing.
 * It replays a settled id and holds a repeat of an in-flight one open for the
 * same answer, so resubmitting cannot publish twice. A typed refusal is the
 * host's answer and is thrown at once; anything else is retried with backoff
 * and, once attempts run out, thrown with the outcome still unknown.
 */
export async function finishUpload(
  flag: BucketsFlag,
  sessionId: string,
  requestId: string,
  {
    attempts = 3,
    backoffMs = 1000,
    send = sendBucketsAction,
    sleep = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
  }: FinishOptions = {}
): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await send({ type: 'finish-upload', flag, sessionId }, requestId);
      return;
    } catch (cause) {
      if (cause instanceof BucketsActionFailed || attempt >= attempts) {
        throw cause;
      }
      await sleep(backoffMs * 2 ** (attempt - 1));
    }
  }
}
