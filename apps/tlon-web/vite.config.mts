/// <reference types="vitest" />
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { tamaguiPlugin } from '@tamagui/vite-plugin';
import { urbitPlugin } from '@urbit/vite-plugin-urbit';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import http from 'node:http';
import https from 'node:https';
import analyze from 'rollup-plugin-analyzer';
import { visualizer } from 'rollup-plugin-visualizer';
import { fileURLToPath } from 'url';
import {
  BuildOptions,
  Plugin,
  PluginOption,
  ProxyOptions,
  defineConfig,
  loadEnv,
} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import svgr from 'vite-plugin-svgr';

import expo52PatchPlugin from './expo52PatchPlugin';
import packageJson from './package.json';
import reactNativeWeb from './reactNativeWebPlugin';
import manifest from './src/manifest';

// Signs the dev server into the ship with DEFAULT_SHIP_LOGIN_ACCESS_CODE and
// attaches the resulting urbauth cookie to proxied requests, so the browser
// never meets the ship's login page. The same two variables prefill the mobile
// app's login form (apps/tlon-mobile/app.config.ts). Dev server only:
// `apply: 'serve'` keeps it out of every build.
function shipLoginPlugin(target: string): Plugin {
  const code = process.env.DEFAULT_SHIP_LOGIN_ACCESS_CODE;
  const loginUrl = process.env.DEFAULT_SHIP_LOGIN_URL;
  // The urbauth cookie is what makes this server act as the user, so it goes
  // only to requests a person's own browser makes to this server from this
  // machine. Vite answers cross-origin requests with
  // Access-Control-Allow-Origin: * and checks no Host header, which is
  // harmless while the browser holds no cookie for localhost and would
  // otherwise let any open website read the ship and poke it as the user. The
  // socket address is what says "this machine": under --host a script on the
  // LAN can send any Host header it likes.
  const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
  // Put our session cookie on the request, dropping any cookie of the same name
  // the browser already holds -- a stale one from a previous ship session would
  // otherwise reach the ship and 401 instead of authenticating.
  const withShipCookie = (existing: string, name: string, value: string) =>
    [
      ...existing
        .split(';')
        .map((c) => c.trim())
        .filter((c) => c && !c.startsWith(`${name}=`)),
      value,
    ].join('; ');
  const isOwnBrowser = (
    remote: string | undefined,
    host?: string,
    origin?: string,
    site?: string
  ) => {
    if (!remote || !LOOPBACK.has(remote)) return false;
    if (!host || !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) {
      return false;
    }
    if (site && site !== 'same-origin' && site !== 'none') return false;
    if (!origin) return true;
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  };
  let cookie: string | null = null;
  let cookieName = '';
  let pending: Promise<void> | null = null;
  return {
    name: 'tlon:ship-login',
    apply: 'serve',
    async configureServer(server) {
      if (!code) return;
      const log = server.config.logger;
      // The code belongs to one ship. A proxy pointed elsewhere -- the e2e
      // ships under SHIP_URL, or a VITE_SHIP_URL that differs -- must not be
      // handed it.
      const strip = (u?: string) => (u ?? '').replace(/\/+$/, '');
      const base = strip(target);
      if (!loginUrl || strip(loginUrl) !== base) {
        log.info(
          `ship login: skipped, the proxy targets ${target} and DEFAULT_SHIP_LOGIN_URL is ${
            loginUrl ?? 'unset'
          }`
        );
        return;
      }
      const url = new URL(`${base}/~/login`);
      const body = new URLSearchParams({ password: code }).toString();
      const login = () =>
        new Promise<void>((resolve, reject) => {
          const mod = url.protocol === 'https:' ? https : http;
          const req = mod.request(
            url,
            {
              method: 'POST',
              headers: {
                'content-type': 'application/x-www-form-urlencoded',
                'content-length': Buffer.byteLength(body),
              },
              timeout: 10_000,
              // The proxy trusts this ship's certificate (`secure: false`
              // below), so the login has to as well, or a self-signed dev ship
              // the proxy can reach rejects the sign-in.
              rejectUnauthorized: false,
            },
            (res) => {
              res.resume();
              const status = res.statusCode ?? 0;
              // A rejected code still comes back with a Set-Cookie (HTTP 400
              // and an urbauth value the ship will not honour), so the status
              // decides.
              const raw = res.headers['set-cookie']?.join(',') ?? '';
              const match = /(urbauth-[^=]+)=[^;,]+/.exec(raw);
              if (status >= 400 || !match) {
                reject(
                  new Error(
                    status === 400
                      ? 'the ship rejected DEFAULT_SHIP_LOGIN_ACCESS_CODE'
                      : `HTTP ${status}`
                  )
                );
                return;
              }
              cookie = match[0];
              cookieName = match[1];
              log.info(`ship login: signed in to ${target}`);
              resolve();
            }
          );
          req.on('timeout', () => req.destroy(new Error('login timed out')));
          req.on('error', reject);
          req.end(body);
        });
      const reason = (err: unknown) => (err as Error).message;
      try {
        await login();
      } catch (err) {
        log.warn(
          `ship login: ${reason(err)}; the ship's login page will appear`
        );
        return;
      }
      server.middlewares.use((req, res, next) => {
        const existing = req.headers.cookie ?? '';
        const own = isOwnBrowser(
          req.socket.remoteAddress,
          req.headers.host,
          req.headers.origin,
          req.headers['sec-fetch-site'] as string | undefined
        );
        if (cookie && own) {
          const injected = cookie;
          req.headers.cookie = withShipCookie(existing, cookieName, cookie);
          // The ship answers a session it no longer knows with 401 on every
          // path, /~/login included, so a stale cookie would lock the browser
          // out too. Drop it and sign in again once; while that is pending,
          // nothing is injected and the ship's own login page works.
          res.once('finish', () => {
            // Only the cookie that earned this 401 is dropped: a slow response
            // sent with the previous one must not undo a sign-in that already
            // replaced it.
            if (res.statusCode !== 401 || pending || cookie !== injected)
              return;
            cookie = null;
            pending = login()
              .catch((err) => {
                log.warn(`ship login: session expired and ${reason(err)}`);
              })
              .finally(() => {
                pending = null;
              });
          });
        }
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default ({ mode }: { mode: string }) => {
  process.env.VITE_STORAGE_VERSION =
    mode === 'dev' ? Date.now().toString() : packageJson.version;

  // loadEnv only reads VITE_-prefixed keys by default. The ship login pair is
  // deliberately unprefixed so the access code never reaches the client bundle;
  // it is consumed here, by the dev server, and nowhere else.
  Object.assign(
    process.env,
    loadEnv(mode, process.cwd(), ['VITE_', 'DEFAULT_SHIP_LOGIN_'])
  );
  // The bundle reads VITE_SHIP_URL as well (packages/app/lib/envVars.ts, for
  // whether the ship is hosted), so the fallback has to reach it too.
  process.env.VITE_SHIP_URL ||= process.env.DEFAULT_SHIP_LOGIN_URL;
  const SHIP_URL =
    process.env.SHIP_URL ||
    process.env.VITE_SHIP_URL ||
    'http://localhost:8080';
  console.log(SHIP_URL);
  const SHIP_URL2 =
    process.env.SHIP_URL2 ||
    process.env.VITE_SHIP_URL2 ||
    'http://localhost:8080';
  console.log(SHIP_URL2);
  const targetShipUrl = mode === 'dev2' ? SHIP_URL2 : SHIP_URL;
  const shouldUploadSourcemaps =
    process.env.CI === 'true' && Boolean(process.env.SENTRY_AUTH_TOKEN);

  // why-did-you-render's jsx runtime wraps every createElement call and pulls
  // the library into the bundle, so only opt in when WDYR is actually enabled
  // (see src/wdyr.ts) rather than in every production build
  const wdyrJsxImportSource =
    process.env.VITE_ENABLE_WDYR === 'true'
      ? '@welldone-software/why-did-you-render'
      : undefined;

  // eslint-disable-next-line
  const base = (mode: string) => {
    console.log('mode', mode);

    if (mode === 'mock' || mode === 'staging') {
      return '';
    }

    if (mode === 'electron') {
      return './';
    }

    return '/apps/groups/';
  };

  // eslint-disable-next-line
  const plugins = (mode: string): PluginOption[] => {
    if (mode === 'mock' || mode === 'staging') {
      return [
        basicSsl() as Plugin,
        react({
          babel: {
            plugins: ['babel-plugin-react-compiler'],
          },
          jsxImportSource: wdyrJsxImportSource,
        }) as PluginOption[],
      ];
    }

    if (mode === 'electron') {
      return [
        exportingRawText(/\.sql$/),
        expo52PatchPlugin(), // Fix Expo 52 static name assignments
        react({
          babel: {
            plugins: [
              'babel-plugin-react-compiler',
              '@babel/plugin-proposal-export-namespace-from',
              'react-native-worklets/plugin',
            ],
          },
          jsxImportSource: wdyrJsxImportSource,
        }) as PluginOption[],
        svgr({
          include: '**/*.svg',
        }) as Plugin,
        reactNativeWeb(),
        tamaguiPlugin({
          config: './tamagui.config.ts',
          platform: 'web',
        }) as Plugin,
      ];
    }

    return [
      process.env.SSL === 'true' ? (basicSsl() as PluginOption) : null,
      exportingRawText(/\.sql$/),
      expo52PatchPlugin(), // Fix Expo 52 static name assignments
      shipLoginPlugin(targetShipUrl),
      urbitPlugin({
        base: 'groups',
        target: targetShipUrl,
        changeOrigin: true,
        secure: false,
      }) as PluginOption[],
      react({
        babel: {
          // adding these per instructions here:
          // https://docs.swmansion.com/react-native-reanimated/docs/guides/web-support/
          plugins: [
            'babel-plugin-react-compiler',
            '@babel/plugin-proposal-export-namespace-from',
            'react-native-worklets/plugin',
          ],
        },
        jsxImportSource: wdyrJsxImportSource,
      }) as PluginOption[],
      svgr({
        include: '**/*.svg',
      }) as Plugin,
      reactNativeWeb(),
      tamaguiPlugin({
        config: './tamagui.config.ts',
        platform: 'web',
      }) as Plugin,
      VitePWA({
        base: '/apps/groups/',
        manifest,
        injectRegister: 'inline',
        registerType: 'prompt',
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw-1.ts',
        useCredentials: true,
        devOptions: {
          enabled: mode === 'sw',
          type: 'module',
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          maximumFileSizeToCacheInBytes: 100000000,
          plugins: [reactNativeWeb()],
        },
      }),
      // Sentry source map upload - only enabled in CI
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_WEB_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        disable: !shouldUploadSourcemaps,
        release: process.env.VITE_GIT_HASH
          ? { name: process.env.VITE_GIT_HASH }
          : undefined,
        sourcemaps: {
          filesToDeleteAfterUpload: ['**/*.map'],
        },
      }),
    ];
  };

  const rollupOptions = {
    external:
      mode === 'mock' || mode === 'staging' || mode === 'electron'
        ? ['react-native-device-info']
        : ['@urbit/sigil-js/dist/core', 'react-native-device-info'],
    output: {
      hashCharacters: 'base36' as any,
      manualChunks: {
        lodash: ['lodash'],
        'lodash/fp': ['lodash/fp'],
        'urbit/api': ['@urbit/api'],
        'urbit/sigil-js': ['@urbit/sigil-js'],
        'any-ascii': ['any-ascii'],
        'tiptap/core': ['@tiptap/core'],
        'tiptap/extension-placeholder': ['@tiptap/extension-placeholder'],
        'tiptap/extension-link': ['@tiptap/extension-link'],
        'aws-sdk/client-s3': ['@aws-sdk/client-s3'],
        'aws-sdk/s3-request-presigner': ['@aws-sdk/s3-request-presigner'],
        'urbit-ob': ['urbit-ob'],
      },
    },
  };

  const port =
    process.env.E2E_PORT_3001 === 'true'
      ? 3001
      : process.env.VITE_PORT
        ? parseInt(process.env.VITE_PORT)
        : 3000;
  const urbitProxy: Record<string, ProxyOptions> = {
    '/apps/groups/~/metagrab/': {
      target: targetShipUrl,
      changeOrigin: true,
      secure: false,
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq) => {
          // Log the path for debugging
          console.log('Proxying request to:', proxyReq.path);
        });
        proxy.on('proxyRes', (proxyRes, req) => {
          console.log(
            'Proxy response for:',
            req.url,
            'Status:',
            proxyRes.statusCode
          );
        });
        proxy.on('error', (err, req) => {
          console.error('Proxy error:', err, 'for request:', req.url);
        });
      },
    },
    '^/apps/groups/desk.js': {
      target: targetShipUrl,
      changeOrigin: true,
      secure: false,
    },
    '^.*//.*': {
      target: targetShipUrl,
      changeOrigin: true,
      secure: false,
      rewrite: (path) => path.replaceAll('//', '/@@@/'),
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq) => {
          proxyReq.path = proxyReq.path.replaceAll('/@@@/', '//');
        });
      },
    },
    '^((?!/apps/groups/).)*$': {
      target: targetShipUrl,
      changeOrigin: true,
      secure: false,
    },
  };

  return defineConfig({
    // @tamagui/vite-plugin overrides envPrefix to ["TAMAGUI_"], blocking VITE_* env vars.
    // Explicitly set both prefixes so VITE_* vars remain available in import.meta.env.
    envPrefix: ['VITE_', 'TAMAGUI_'],
    // expo 56's runtime (expo/src/async-require/setupHMR) reads process.env.EXPO_OS
    // to resolve the platform. Metro inlines it via babel-preset-expo; the vite web
    // build must define it explicitly or expo throws "Missing required parameter
    // `platform`" at boot.
    define: {
      'process.env.EXPO_OS': JSON.stringify('web'),
    },
    base: base(mode),
    server: {
      host: 'localhost',
      port,
      //NOTE  the proxy used by vite is written poorly, and ends up removing
      //      empty path segments from urls: http-party/node-http-proxy#1420.
      //      as a workaround for this, we rewrite the path going into the
      //      proxy to "hide" the empty path segments, and then rewrite the
      //      path coming "out" of the proxy to obtain the original path.
      proxy: urbitProxy,
    },
    preview: {
      proxy: urbitProxy,
    },
    build:
      mode !== 'profile'
        ? {
            // Generate sourcemaps only when CI can upload them to Sentry.
            sourcemap: shouldUploadSourcemaps ? 'hidden' : false,
            rollupOptions,
            target: 'esnext',
          }
        : ({
            rollupOptions: {
              ...rollupOptions,
              plugins: [
                analyze({
                  limit: 20,
                }),
                visualizer(),
              ],
            },
          } as BuildOptions),
    worker: {
      format: 'es',
      rollupOptions: {
        output: {
          hashCharacters: 'base36' as any,
        },
      },
    },
    plugins: plugins(mode),
    resolve: {
      conditions: ['tlon-source'],
      dedupe: ['@tanstack/react-query'],
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        // The root pnpm override pins the version; this keeps Vite from resolving
        // a stale nested copy before the patched top-level package.
        'react-native-reanimated': fileURLToPath(
          new URL('../../node_modules/react-native-reanimated', import.meta.url)
        ),
        '@react-navigation/elements': fileURLToPath(
          new URL(
            '../../node_modules/@react-navigation/elements',
            import.meta.url
          )
        ),
        ...(mode === 'electron'
          ? {
              'virtual:pwa-register/react': fileURLToPath(
                new URL('./src/logic/useAppUpdatesStub.ts', import.meta.url)
              ),
              '@react-native-firebase/crashlytics': fileURLToPath(
                new URL('./src/crashlytics-stub.ts', import.meta.url)
              ),
              'expo-notifications': fileURLToPath(
                new URL('./src/notifications-stub.ts', import.meta.url)
              ),
            }
          : {}),
      },
    },
    optimizeDeps: {
      exclude: [
        'sqlocal',
        ...(mode === 'electron' ? ['virtual:pwa-register/react'] : []),
      ],
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './test/setup.ts',
      deps: {},
      include: ['**/*.test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      server: {
        deps: {
          inline: ['react-tweet'],
        },
      },
    },
  });
};

/** Transforms matching files into ES modules that export the file's content as a string */
function exportingRawText(matchId: RegExp): Plugin {
  return {
    name: 'inline sql',
    enforce: 'pre',
    transform(_code, id) {
      if (matchId.test(id)) {
        const sql = fs.readFileSync(id, 'utf-8');
        return `export default ${JSON.stringify(sql)}`;
      }
    },
  };
}
