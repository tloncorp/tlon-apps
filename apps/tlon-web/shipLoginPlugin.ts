import type { Plugin } from 'vite';

/**
 * Answers the ship's login page with a copy whose access code is already
 * filled in, so a dev browser signs itself in with
 * DEFAULT_SHIP_LOGIN_ACCESS_CODE instead of the code being typed. The same two
 * variables prefill the mobile app's login form
 * (apps/tlon-mobile/app.config.ts). The browser posts the form itself, so the
 * session cookie is the ship's own, set in the browser the usual way. Dev
 * server only: `apply: 'serve'` keeps it out of every build.
 */
export default function shipLoginPlugin(
  target: string,
  appBase: string
): Plugin {
  const code = process.env.DEFAULT_SHIP_LOGIN_ACCESS_CODE;
  const loginUrl = process.env.DEFAULT_SHIP_LOGIN_URL;
  // The page carries the ship's access code, so it goes only to a browser on
  // this machine. Vite answers cross-origin requests with
  // Access-Control-Allow-Origin: * and checks no Host header, so without this
  // any open website could read the code off this server under --host. The
  // socket address is what says "this machine": a Host header can claim
  // anything.
  const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
  const isOwnBrowser = (remote: string | undefined, host?: string) =>
    !!remote &&
    LOOPBACK.has(remote) &&
    !!host &&
    /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  const escape = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[c] as string
    );
  // Eyre puts the post-login destination in a hidden field.
  // Pass through only a path on this server, never an absolute url that would
  // send the browser to another origin. A missing destination, or the bare `/`
  // this app asks for, means the ship's own landing page, so send the browser
  // back to the app it came from instead.
  const safeRedirect = (url: string) => {
    const query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
    const to = new URLSearchParams(query).get('redirect') ?? '';
    return /^\/(?!\/)/.test(to) && to !== '/' ? to : appBase;
  };
  const page = (redirect: string) => `<!doctype html>
<meta charset="utf-8" />
<title>Signing in</title>
<body style="font: 14px system-ui; margin: 3rem">
  <form id="login" method="post" action="/~/login">
    <input type="password" name="password" value="${escape(code ?? '')}" />
    <input type="hidden" name="redirect" value="${escape(redirect)}" />
    <button type="submit">Sign in to ${escape(target)}</button>
  </form>
  <script>
    // Submitting once per tab: a code the ship rejects comes back as its own
    // login page, and landing here again should leave the form to the person
    // rather than retrying on its own.
    try {
      if (!sessionStorage.getItem('tlon-dev-login')) {
        sessionStorage.setItem('tlon-dev-login', '1');
        document.getElementById('login').submit();
      }
    } catch (err) {
      // A browser with storage disabled just gets the filled-in form.
    }
  </script>
</body>
`;
  return {
    name: 'tlon:ship-login',
    apply: 'serve',
    configureServer(server) {
      if (!code) return;
      const log = server.config.logger;
      const strip = (u?: string) => (u ?? '').replace(/\/+$/, '');
      const base = strip(target);
      // The code belongs to one ship. A proxy pointed elsewhere -- the e2e
      // ships under SHIP_URL, or a VITE_SHIP_URL that differs -- must not be
      // handed it.
      if (!loginUrl || strip(loginUrl) !== base) {
        log.info(
          `ship login: skipped, the proxy targets ${target} and DEFAULT_SHIP_LOGIN_URL is ${
            loginUrl ?? 'unset'
          }`
        );
        return;
      }
      // Eyre's own code pattern: anything else is not a code, and refusing it
      // here keeps whatever it is out of the page.
      if (!/^[a-z]{6}(-[a-z]{6}){3}$/.test(code)) {
        log.warn(
          'ship login: skipped, DEFAULT_SHIP_LOGIN_ACCESS_CODE is not a ship code'
        );
        return;
      }
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (req.method !== 'GET' || url.split('?')[0] !== '/~/login') {
          return next();
        }
        if (!isOwnBrowser(req.socket.remoteAddress, req.headers.host)) {
          return next();
        }
        res.setHeader('content-type', 'text/html; charset=utf-8');
        res.setHeader('cache-control', 'no-store');
        res.end(page(safeRedirect(url)));
      });
      log.info(`ship login: the login page for ${target} is prefilled`);
    },
  };
}
