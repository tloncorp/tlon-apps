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
