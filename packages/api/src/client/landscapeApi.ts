// A hung login would otherwise be unbounded, and callers wait on it before
// retrying the request that triggered the reauth — holding a sync queue worker
// for as long as the ship stays silent.
const LOGIN_TIMEOUT = 30 * 1000;

export const getLandscapeAuthCookie = async (
  shipUrl: string,
  accessCode: string
) => {
  // AbortSignal.timeout isn't available on every runtime we ship to.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOGIN_TIMEOUT);

  let response: Response;
  try {
    response = await fetch(`${shipUrl}/~/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: `password=${accessCode}`,
      credentials: 'include',
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`Login timed out after ${LOGIN_TIMEOUT}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (response.status < 200 || response.status > 299) {
    throw new AuthFailureError(response.status);
  }

  return response.headers.get('set-cookie')?.split(';')[0];
};

export class AuthFailureError extends Error {
  public responseStatus: number;
  constructor(responseStatus: number) {
    // eyre answers 400 when the code itself is wrong, and 401 when the request
    // carried a session cookie it no longer recognizes (it expires that
    // cookie in the response); only the former says anything about the code
    const hint =
      responseStatus === 400
        ? 'The access code was rejected.'
        : responseStatus === 401
          ? 'The ship rejected a stale session cookie.'
          : 'Unexpected response from the ship.';
    super(`Authentication failed with status ${responseStatus}. ${hint}`);
    this.name = 'AuthFailureError';
    this.responseStatus = responseStatus;
  }
}
