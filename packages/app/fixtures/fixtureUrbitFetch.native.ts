import CookieManager from '@react-native-cookies/cookies';

function proxyHeaders(headers: Headers, setCookie: string) {
  return new Proxy(headers, {
    get(target, property) {
      if (property === 'get') {
        return (name: string) =>
          name.toLowerCase() === 'set-cookie' ? setCookie : target.get(name);
      }
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

function proxyResponse(response: Response, setCookie: string) {
  const headers = proxyHeaders(response.headers, setCookie);
  return new Proxy(response, {
    get(target, property) {
      if (property === 'headers') return headers;
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

export function createFixtureUrbitFetch(shipUrl: string): typeof fetch {
  const ship = new URL(shipUrl).hostname.split('.')[0];
  const authCookieName = `urbauth-~${ship}`;

  return async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.delete('Cookie');
    const response = await fetch(input, {
      ...init,
      credentials: undefined,
      headers,
    });
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    if (!url.endsWith('/~/login') || !response.ok) return response;
    const responseCookie = response.headers.get('set-cookie');

    const cookies = await CookieManager.get(shipUrl);
    if (responseCookie?.startsWith(`${authCookieName}=`)) return response;
    const authCookie = cookies[authCookieName];
    if (!authCookie) return response;

    return proxyResponse(
      response,
      `${authCookie.name}=${authCookie.value}; Path=/; HttpOnly`
    );
  };
}
