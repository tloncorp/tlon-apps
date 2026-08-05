import { createDevLogger } from '@tloncorp/shared';

const logger = createDevLogger('notes', false);
const MAX_NOTES_ERROR_MESSAGE_LENGTH = 500;

function sanitizeNotesErrorMessage(message: string) {
  const redacted = message.replace(/\b0v[0-9a-z.-]+\b/gi, '[request-id]');
  if (redacted.length <= MAX_NOTES_ERROR_MESSAGE_LENGTH) {
    return redacted;
  }
  return `${redacted.slice(0, MAX_NOTES_ERROR_MESSAGE_LENGTH)}...`;
}

function getErrorName(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}

function getRawErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return null;
}

export function trackNotesActionError(
  action: string,
  error: unknown,
  displayMessage: string,
  metadata?: Record<string, unknown>
) {
  const rawErrorMessage = getRawErrorMessage(error);
  logger.trackError('Notes action failed', {
    ...metadata,
    action,
    errorMessage: sanitizeNotesErrorMessage(displayMessage),
    errorName: getErrorName(error),
    rawErrorMessage: rawErrorMessage
      ? sanitizeNotesErrorMessage(rawErrorMessage)
      : undefined,
  });
}
