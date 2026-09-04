export const getLandscapeAuthCookie = async (
  shipUrl: string,
  accessCode: string
) => {
  const response = await fetch(`${shipUrl}/~/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: `password=${accessCode}`,
    credentials: 'include',
  });

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
