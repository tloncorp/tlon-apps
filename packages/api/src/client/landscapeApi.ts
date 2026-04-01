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
    super(
      `Authentication failed with status ${responseStatus}. Is your access code correct?`
    );
    this.name = 'AuthFailureError';
    this.responseStatus = responseStatus;
  }
}
