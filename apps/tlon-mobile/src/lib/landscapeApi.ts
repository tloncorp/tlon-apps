import { getShipFromCookie } from '../utils/ship';

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

  return response.headers.get('set-cookie')?.split(';')[0];
};

interface AuthPayload {
  ship: string;
  cookie: string;
}

export const getDevCookie = async (
  shipUrl: string,
  accessCode: string
): Promise<AuthPayload | null> => {
  try {
    const response = await fetch(`${shipUrl}/~/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: `password=${accessCode}`,
      credentials: 'include',
    });

    const cookie = response.headers.get('set-cookie') || '';
    if (!cookie) return null;

    return {
      ship: getShipFromCookie(cookie),
      cookie,
    };
  } catch (err) {
    console.error('Error getting dev cookie:', err);
    return null;
  }
};
