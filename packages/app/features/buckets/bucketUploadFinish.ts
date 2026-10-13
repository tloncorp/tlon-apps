import { BucketsActionFailed, type BucketsFlag } from '@tloncorp/api';
import { sendBucketsAction } from '@tloncorp/api';

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
 * outcome is unknown, so the row keeps its request id rather than starting
 * over and uploading a second copy.
 */
export function isFinishRefusal(cause: unknown) {
  return cause instanceof BucketsActionFailed && cause.type !== 'unknown';
}

/**
 * Send finish-upload, and re-ask once under the same request id if the
 * answer is lost -- as begin-upload does.
 *
 * The host replays a settled id and holds a repeat of an in-flight one open
 * for the same answer, so the re-ask cannot publish twice. A typed answer is
 * not re-asked: under the same id the host would only replay it. Anything
 * still unresolved after that is left to the row, and to Retry.
 */
export async function finishUpload(
  flag: BucketsFlag,
  sessionId: string,
  requestId: string,
  send: typeof sendBucketsAction = sendBucketsAction
): Promise<void> {
  const finish = () =>
    send({ type: 'finish-upload', flag, sessionId }, requestId);
  await finish().catch((cause) => {
    if (cause instanceof BucketsActionFailed) throw cause;
    return finish();
  });
}
