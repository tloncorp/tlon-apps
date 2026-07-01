export type UrbitErrorCode =
  | 'invalid_url'
  | 'http_error'
  | 'auth_failed'
  | 'missing_cookie'
  | 'channel_not_open';

export class UrbitError extends Error {
  readonly code: UrbitErrorCode;

  constructor(
    code: UrbitErrorCode,
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = 'UrbitError';
    this.code = code;
  }
}

export class UrbitUrlError extends UrbitError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('invalid_url', message, options);
    this.name = 'UrbitUrlError';
  }
}

export class UrbitHttpError extends UrbitError {
  readonly status: number;
  readonly operation: string;
  readonly bodyText?: string;

  constructor(params: {
    operation: string;
    status: number;
    bodyText?: string;
    cause?: unknown;
  }) {
    const suffix = params.bodyText ? ` - ${params.bodyText}` : '';
    super(
      'http_error',
      `${params.operation} failed: ${params.status}${suffix}`,
      {
        cause: params.cause,
      }
    );
    this.name = 'UrbitHttpError';
    this.status = params.status;
    this.operation = params.operation;
    this.bodyText = params.bodyText;
  }
}

export class UrbitAuthError extends UrbitError {
  constructor(
    code: 'auth_failed' | 'missing_cookie',
    message: string,
    options?: { cause?: unknown }
  ) {
    super(code, message, options);
    this.name = 'UrbitAuthError';
  }
}

/**
 * Format an error for logging, surfacing `err.cause` when present.
 *
 * Node/undici wraps transport failures as `TypeError: fetch failed` and hangs
 * the real reason off `.cause` (typically with a `.code` like `ECONNRESET` /
 * `UND_ERR_SOCKET` / `UND_ERR_CONNECT_TIMEOUT`). Plain `String(err)` drops
 * that, leaving an undiagnosable "fetch failed". This appends the cause's
 * `code` (preferred) or `message` so logs say which transport failure it was.
 */
export function describeError(err: unknown): string {
  if (!(err instanceof Error)) {
    return String(err);
  }
  const cause = (err as { cause?: unknown }).cause;
  if (cause === undefined || cause === null) {
    return err.message;
  }
  const causeCode = (cause as { code?: unknown }).code;
  if (typeof causeCode === 'string' && causeCode.length > 0) {
    return `${err.message} cause=${causeCode}`;
  }
  if (cause instanceof Error) {
    return `${err.message} cause=${cause.message}`;
  }
  return `${err.message} cause=${String(cause)}`;
}
