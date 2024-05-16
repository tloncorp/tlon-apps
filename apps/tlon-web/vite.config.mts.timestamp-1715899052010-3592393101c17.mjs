// vite.config.mts
import { tamaguiPlugin } from "file:///Users/brian/src/tlon/mono/node_modules/@tamagui/vite-plugin/dist/esm/index.mjs";
import { urbitPlugin } from "file:///Users/brian/src/tlon/mono/node_modules/@urbit/vite-plugin-urbit/dist/index.js";
import basicSsl from "file:///Users/brian/src/tlon/mono/node_modules/@vitejs/plugin-basic-ssl/dist/index.mjs";
import react from "file:///Users/brian/src/tlon/mono/node_modules/@vitejs/plugin-react/dist/index.mjs";
import analyze from "file:///Users/brian/src/tlon/mono/node_modules/rollup-plugin-analyzer/index.js";
import { visualizer } from "file:///Users/brian/src/tlon/mono/node_modules/rollup-plugin-visualizer/dist/plugin/index.js";
import { fileURLToPath } from "url";
import {
  defineConfig,
  loadEnv
} from "file:///Users/brian/src/tlon/mono/node_modules/vite/dist/node/index.js";
import { VitePWA } from "file:///Users/brian/src/tlon/mono/node_modules/vite-plugin-pwa/dist/index.js";
import svgr from "file:///Users/brian/src/tlon/mono/node_modules/vite-plugin-svgr/dist/index.js";

// package.json
var package_default = {
  name: "tlon-web",
  version: "5.7.0",
  private: true,
  scripts: {
    rube: "tsc ./rube/index.ts --outDir ./rube/dist && node ./rube/dist/index.js",
    build: "tsc && vite build",
    "build:mock": "tsc && vite build --mode staging",
    "build:profile": "tsc && vite build --mode profile",
    coverage: "cross-env TZ=UTC vitest run --coverage",
    dev: "cross-env SSL=true vite",
    "dev:native": "cross-env APP=chat vite --mode native --host",
    "dev-no-ssl": "vite",
    dev2: "cross-env SSL=true vite --mode dev2",
    multi: 'cross-env SSL=true concurrently "vite" "vite --mode dev2"',
    "dev-sw": "vite --mode sw",
    lint: "eslint src/",
    "lint:fix": "eslint src/ --fix --quiet",
    "lint:format": "prettier src/ --write",
    "lint:all": "pnpm lint:format && pnpm run lint:fix",
    "lint:staged": "lint-staged",
    mock: "vite --mode mock",
    serve: "vite preview",
    "serve-sw": "vite preview --mode sw",
    test: "cross-env TZ=UTC vitest",
    e2e: "pnpm rube",
    "e2e:debug:zod": "cross-env DEBUG_PLAYWRIGHT=true SHIP_NAME=zod pnpm run e2e",
    "e2e:debug:bus": "cross-env DEBUG_PLAYWRIGHT=true SHIP_NAME=bus pnpm run e2e",
    "e2e:debug": "cross-env DEBUG_PLAYWRIGHT=true pnpm e2e",
    tsc: "tsc --noEmit",
    "e2e:codegen": 'concurrently "pnpm dev-no-ssl" "pnpm exec playwright codegen http://localhost:3000"',
    cosmos: "cosmos"
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "pnpm lint:fix",
      "pnpm lint:format"
    ]
  },
  dependencies: {
    "@aws-sdk/client-s3": "^3.190.0",
    "@aws-sdk/s3-request-presigner": "^3.190.0",
    "@emoji-mart/data": "^1.0.6",
    "@emoji-mart/react": "^1.0.1",
    "@radix-ui/react-accordion": "^1.1.2",
    "@radix-ui/react-collapsible": "^1.0.3",
    "@radix-ui/react-dialog": "^1.0.4",
    "@radix-ui/react-dropdown-menu": "^2.0.5",
    "@radix-ui/react-popover": "^1.0.2",
    "@radix-ui/react-radio-group": "^1.1.3",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-toast": "^1.0.0",
    "@radix-ui/react-toggle": "^1.0.2",
    "@radix-ui/react-toggle-group": "^1.0.4",
    "@radix-ui/react-tooltip": "^1.0.0",
    "@tamagui/vite-plugin": "1.93.2",
    "@tanstack/react-query": "^4.28.0",
    "@tanstack/react-query-devtools": "^4.28.0",
    "@tanstack/react-query-persist-client": "^4.28.0",
    "@tanstack/react-virtual": "^3.0.0-beta.60",
    "@tiptap/core": "^2.0.3",
    "@tiptap/extension-blockquote": "^2.0.3",
    "@tiptap/extension-bold": "^2.0.3",
    "@tiptap/extension-bullet-list": "^2.0.3",
    "@tiptap/extension-code": "^2.0.3",
    "@tiptap/extension-code-block": "^2.0.3",
    "@tiptap/extension-document": "^2.0.3",
    "@tiptap/extension-floating-menu": "^2.0.3",
    "@tiptap/extension-hard-break": "^2.0.3",
    "@tiptap/extension-heading": "^2.0.3",
    "@tiptap/extension-history": "^2.0.3",
    "@tiptap/extension-horizontal-rule": "^2.0.3",
    "@tiptap/extension-italic": "^2.0.3",
    "@tiptap/extension-link": "^2.0.3",
    "@tiptap/extension-list-item": "^2.0.3",
    "@tiptap/extension-mention": "^2.0.3",
    "@tiptap/extension-ordered-list": "^2.0.3",
    "@tiptap/extension-paragraph": "^2.0.3",
    "@tiptap/extension-placeholder": "^2.0.3",
    "@tiptap/extension-strike": "^2.0.3",
    "@tiptap/extension-task-item": "^2.1.7",
    "@tiptap/extension-task-list": "^2.1.7",
    "@tiptap/extension-text": "^2.0.3",
    "@tiptap/pm": "^2.0.3",
    "@tiptap/react": "^2.0.3",
    "@tiptap/suggestion": "^2.0.3",
    "@tloncorp/mock-http-api": "^1.2.0",
    "@tloncorp/shared": "workspace:*",
    "@tloncorp/ui": "workspace:*",
    "@types/marked": "^4.3.0",
    "@urbit/api": "^2.2.0",
    "@urbit/aura": "^1.0.0",
    "@urbit/http-api": "^3.1.0-dev-2",
    "@urbit/sigil-js": "^2.2.0",
    "any-ascii": "^0.3.1",
    "big-integer": "^1.6.51",
    "browser-cookies": "^1.2.0",
    "browser-image-compression": "^2.0.2",
    classnames: "^2.3.1",
    "clipboard-copy": "^4.0.1",
    color2k: "^2.0.0",
    "cross-fetch": "^3.1.5",
    "date-fns": "^2.28.0",
    dompurify: "^3.0.6",
    "emoji-mart": "^5.2.2",
    "emoji-regex": "^10.2.1",
    "fast-average-color": "^9.1.1",
    "framer-motion": "^6.5.1",
    fuzzy: "^0.1.3",
    "get-youtube-id": "^1.0.1",
    "hast-to-hyperscript": "^10.0.1",
    history: "^5.3.0",
    "idb-keyval": "^6.2.0",
    immer: "^9.0.12",
    lodash: "^4.17.21",
    marked: "^4.3.0",
    masonic: "^3.6.5",
    moment: "^2.29.4",
    "posthog-js": "^1.68.2",
    prismjs: "^1.29.0",
    "prosemirror-commands": "~1.2.2",
    "prosemirror-history": "~1.2.0",
    "prosemirror-keymap": "~1.1.5",
    "prosemirror-markdown": "^1.11.1",
    "prosemirror-model": "~1.16.1",
    "prosemirror-schema-list": "~1.1.6",
    "prosemirror-state": "~1.3.4",
    "prosemirror-transform": "~1.4.2",
    "prosemirror-view": "~1.23.13",
    react: "^18.2.0",
    "react-beautiful-dnd": "^13.1.1",
    "react-colorful": "^5.5.1",
    "react-dnd": "^15.1.1",
    "react-dnd-html5-backend": "^15.1.2",
    "react-dnd-touch-backend": "^15.1.1",
    "react-dom": "^18.2.0",
    "react-error-boundary": "^3.1.4",
    "react-helmet": "^6.1.0",
    "react-hook-form": "^7.30.0",
    "react-image-size": "^2.0.0",
    "react-intersection-observer": "^9.4.0",
    "react-oembed-container": "github:stefkampen/react-oembed-container",
    "react-qr-code": "^2.0.12",
    "react-router": "^6.22.1",
    "react-router-dom": "^6.22.1",
    "react-select": "^5.3.2",
    "react-tweet": "^3.0.4",
    "react-virtuoso": "^4.5.1",
    refractor: "^4.8.0",
    slugify: "^1.6.6",
    "sorted-btree": "^1.8.1",
    "tailwindcss-opentype": "^1.1.0",
    "tailwindcss-scoped-groups": "^2.0.0",
    "tippy.js": "^6.3.7",
    "urbit-ob": "^5.0.1",
    "use-pwa-install": "^1.0.1",
    "usehooks-ts": "^2.6.0",
    uuid: "^9.0.0",
    validator: "^13.7.0",
    vaul: "github:latter-bolden/vaul",
    "video-react": "^0.16.0",
    "vite-plugin-svgr": "^4.2.0",
    "workbox-precaching": "^6.5.4",
    zustand: "^3.7.2"
  },
  devDependencies: {
    "@faker-js/faker": "^8.4.1",
    "@playwright/test": "^1.33.0",
    "@tailwindcss/aspect-ratio": "^0.4.0",
    "@tailwindcss/container-queries": "^0.1.0",
    "@tailwindcss/typography": "^0.5.7",
    "@testing-library/jest-dom": "^5.16.4",
    "@testing-library/react": "^14.0.0",
    "@testing-library/user-event": "^14.2.0",
    "@types/dompurify": "^3.0.5",
    "@types/fs-extra": "^11.0.1",
    "@types/lodash": "4.14.183",
    "@types/node": "^20.10.8",
    "@types/node-fetch": "^2.6.4",
    "@types/portscanner": "^2.1.1",
    "@types/prismjs": "^1.26.0",
    "@types/qrcode": "^1.5.2",
    "@types/react": "^18.2.46",
    "@types/react-beautiful-dnd": "^13.1.2",
    "@types/react-dom": "^18.2.7",
    "@types/react-helmet": "^6.1.5",
    "@types/react-test-renderer": "^18.0.0",
    "@types/tar-fs": "^2.0.1",
    "@types/uuid": "^9.0.2",
    "@types/validator": "^13.7.2",
    "@types/video-react": "^0.15.1",
    "@types/ws": "^8.5.3",
    "@urbit/vite-plugin-urbit": "^2.0.1",
    "@vitejs/plugin-basic-ssl": "^1.1.0",
    "@vitejs/plugin-react": "^4.2.1",
    "@welldone-software/why-did-you-render": "^7.0.1",
    autoprefixer: "^10.4.4",
    concurrently: "^8.0.1",
    "cross-env": "^7.0.3",
    "fs-extra": "^11.1.1",
    jsdom: "^23.2.0",
    "lint-staged": "^15.0.0",
    msw: "^0.44.2",
    "node-fetch": "^2.6.12",
    postcss: "^8.4.12",
    "postcss-import": "^14.1.0",
    prettier: "^3.1.1",
    "react-cosmos": "6.1.1",
    "react-cosmos-plugin-vite": "6.1.1",
    "react-test-renderer": "^18.2.0",
    "rollup-plugin-analyzer": "^4.0.0",
    "rollup-plugin-visualizer": "^5.6.0",
    tailwindcss: "^3.2.7",
    "tailwindcss-theme-swapper": "^0.7.3",
    "tar-fs": "^3.0.4",
    "tsc-files": "^1.1.4",
    vite: "^5.1.6",
    "vite-plugin-pwa": "^0.17.5",
    vitest: "^0.34.1",
    "workbox-window": "^7.0.0"
  },
  msw: {
    workerDirectory: "./public"
  }
};

// src/manifest.ts
var manifest = {
  name: "Tlon",
  description: "Start, host, and cultivate communities. Own your communications, organize your resources, and share documents. Tlon is a peer-to-peer collaboration tool built on Urbit that provides a few simple basics that communities can shape into something unique to their needs.",
  short_name: "Tlon",
  start_url: "/apps/groups",
  scope: "/apps/groups",
  id: "/apps/groups/",
  icons: [
    {
      src: "./icon-512.png",
      sizes: "512x512",
      type: "image/png"
    },
    {
      src: "./icon-192.png",
      sizes: "192x192",
      type: "image/png"
    },
    {
      src: "./icon-512-maskable.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable"
    },
    {
      src: "./icon-192-maskable.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "maskable"
    }
  ],
  theme_color: "#ffffff",
  background_color: "#ffffff",
  display: "standalone"
};
var manifest_default = manifest;

// vite.config.mts
var __vite_injected_original_import_meta_url = "file:///Users/brian/src/tlon/mono/apps/tlon-web/vite.config.mts";
var vite_config_default = ({ mode }) => {
  process.env.VITE_STORAGE_VERSION = mode === "dev" ? Date.now().toString() : package_default.version;
  Object.assign(process.env, loadEnv(mode, process.cwd()));
  const SHIP_URL = process.env.SHIP_URL || process.env.VITE_SHIP_URL || "http://localhost:8080";
  console.log(SHIP_URL);
  const SHIP_URL2 = process.env.SHIP_URL2 || process.env.VITE_SHIP_URL2 || "http://localhost:8080";
  console.log(SHIP_URL2);
  const base = (mode2) => {
    if (mode2 === "mock" || mode2 === "staging") {
      return "";
    }
    return "/apps/groups/";
  };
  const plugins = (mode2) => {
    if (mode2 === "mock" || mode2 === "staging") {
      return [
        basicSsl(),
        react({
          jsxImportSource: "@welldone-software/why-did-you-render"
        })
      ];
    }
    return [
      process.env.SSL === "true" ? basicSsl() : null,
      urbitPlugin({
        base: "groups",
        target: mode2 === "dev2" ? SHIP_URL2 : SHIP_URL,
        changeOrigin: true,
        secure: false
      }),
      react({
        jsxImportSource: "@welldone-software/why-did-you-render"
      }),
      svgr({
        include: "**/*.svg"
      }),
      tamaguiPlugin({
        config: "./tamagui.config.ts",
        platform: "web"
      }),
      VitePWA({
        base: "/apps/groups/",
        manifest: manifest_default,
        injectRegister: "inline",
        registerType: "prompt",
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.ts",
        devOptions: {
          enabled: mode2 === "sw",
          type: "module"
        },
        injectManifest: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
          maximumFileSizeToCacheInBytes: 1e8
        }
      })
    ];
  };
  const rollupOptions = {
    external: mode === "mock" || mode === "staging" ? ["virtual:pwa-register/react"] : (
      // TODO: find workaround for issues with @tamagui/react-native-svg
      ["@urbit/sigil-js/dist/core", "react-native-svg"]
    ),
    output: {
      hashCharacters: "base36",
      manualChunks: {
        lodash: ["lodash"],
        "lodash/fp": ["lodash/fp"],
        "urbit/api": ["@urbit/api"],
        "urbit/http-api": ["@urbit/http-api"],
        "urbit/sigil-js": ["@urbit/sigil-js"],
        "any-ascii": ["any-ascii"],
        "react-beautiful-dnd": ["react-beautiful-dnd"],
        "emoji-mart": ["emoji-mart"],
        "tiptap/core": ["@tiptap/core"],
        "tiptap/extension-placeholder": ["@tiptap/extension-placeholder"],
        "tiptap/extension-link": ["@tiptap/extension-link"],
        "react-virtuoso": ["react-virtuoso"],
        "react-select": ["react-select"],
        "react-hook-form": ["react-hook-form"],
        "framer-motion": ["framer-motion"],
        "date-fns": ["date-fns"],
        "tippy.js": ["tippy.js"],
        "aws-sdk/client-s3": ["@aws-sdk/client-s3"],
        "aws-sdk/s3-request-presigner": ["@aws-sdk/s3-request-presigner"],
        refractor: ["refractor"],
        "urbit-ob": ["urbit-ob"],
        "hast-to-hyperscript": ["hast-to-hyperscript"],
        "radix-ui/react-dialog": ["@radix-ui/react-dialog"],
        "radix-ui/react-dropdown-menu": ["@radix-ui/react-dropdown-menu"],
        "radix-ui/react-popover": ["@radix-ui/react-popover"],
        "radix-ui/react-toast": ["@radix-ui/react-toast"],
        "radix-ui/react-tooltip": ["@radix-ui/react-tooltip"]
      }
    }
  };
  return defineConfig({
    base: base(mode),
    server: {
      host: "localhost",
      port: process.env.E2E_PORT_3001 === "true" ? 3001 : 3e3,
      //NOTE  the proxy used by vite is written poorly, and ends up removing
      //      empty path segments from urls: http-party/node-http-proxy#1420.
      //      as a workaround for this, we rewrite the path going into the
      //      proxy to "hide" the empty path segments, and then rewrite the
      //      path coming "out" of the proxy to obtain the original path.
      proxy: {
        "^.*//.*": {
          target: SHIP_URL,
          rewrite: (path) => path.replaceAll("//", "/@@@/"),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              proxyReq.path = proxyReq.path.replaceAll("/@@@/", "//");
            });
          }
        }
      }
    },
    build: mode !== "profile" ? {
      sourcemap: false,
      rollupOptions
    } : {
      rollupOptions: {
        ...rollupOptions,
        plugins: [
          analyze({
            limit: 20
          }),
          visualizer()
        ]
      }
    },
    plugins: plugins(mode),
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url))
      }
    },
    optimizeDeps: {
      esbuildOptions: {
        // Fix for polyfill issue with @tamagui/animations-moti
        define: {
          global: "globalThis"
        }
      }
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./test/setup.ts",
      deps: {},
      include: ["**/*.test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
      server: {
        deps: {
          inline: ["react-tweet"]
        }
      }
    }
  });
};
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcubXRzIiwgInBhY2thZ2UuanNvbiIsICJzcmMvbWFuaWZlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvYnJpYW4vc3JjL3Rsb24vbW9uby9hcHBzL3Rsb24td2ViXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvYnJpYW4vc3JjL3Rsb24vbW9uby9hcHBzL3Rsb24td2ViL3ZpdGUuY29uZmlnLm10c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvYnJpYW4vc3JjL3Rsb24vbW9uby9hcHBzL3Rsb24td2ViL3ZpdGUuY29uZmlnLm10c1wiOy8vLyA8cmVmZXJlbmNlIHR5cGVzPVwidml0ZXN0XCIgLz5cbmltcG9ydCB7IHRhbWFndWlQbHVnaW4gfSBmcm9tICdAdGFtYWd1aS92aXRlLXBsdWdpbic7XG5pbXBvcnQgeyB1cmJpdFBsdWdpbiB9IGZyb20gJ0B1cmJpdC92aXRlLXBsdWdpbi11cmJpdCc7XG5pbXBvcnQgYmFzaWNTc2wgZnJvbSAnQHZpdGVqcy9wbHVnaW4tYmFzaWMtc3NsJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgYW5hbHl6ZSBmcm9tICdyb2xsdXAtcGx1Z2luLWFuYWx5emVyJztcbmltcG9ydCB7IHZpc3VhbGl6ZXIgfSBmcm9tICdyb2xsdXAtcGx1Z2luLXZpc3VhbGl6ZXInO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ3VybCc7XG5pbXBvcnQge1xuICBCdWlsZE9wdGlvbnMsXG4gIFBsdWdpbixcbiAgUGx1Z2luT3B0aW9uLFxuICBkZWZpbmVDb25maWcsXG4gIGxvYWRFbnYsXG59IGZyb20gJ3ZpdGUnO1xuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXB3YSc7XG5pbXBvcnQgc3ZnciBmcm9tICd2aXRlLXBsdWdpbi1zdmdyJztcblxuaW1wb3J0IHBhY2thZ2VKc29uIGZyb20gJy4vcGFja2FnZS5qc29uJztcbmltcG9ydCBtYW5pZmVzdCBmcm9tICcuL3NyYy9tYW5pZmVzdCc7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCAoeyBtb2RlIH06IHsgbW9kZTogc3RyaW5nIH0pID0+IHtcbiAgcHJvY2Vzcy5lbnYuVklURV9TVE9SQUdFX1ZFUlNJT04gPVxuICAgIG1vZGUgPT09ICdkZXYnID8gRGF0ZS5ub3coKS50b1N0cmluZygpIDogcGFja2FnZUpzb24udmVyc2lvbjtcblxuICBPYmplY3QuYXNzaWduKHByb2Nlc3MuZW52LCBsb2FkRW52KG1vZGUsIHByb2Nlc3MuY3dkKCkpKTtcbiAgY29uc3QgU0hJUF9VUkwgPVxuICAgIHByb2Nlc3MuZW52LlNISVBfVVJMIHx8XG4gICAgcHJvY2Vzcy5lbnYuVklURV9TSElQX1VSTCB8fFxuICAgICdodHRwOi8vbG9jYWxob3N0OjgwODAnO1xuICBjb25zb2xlLmxvZyhTSElQX1VSTCk7XG4gIGNvbnN0IFNISVBfVVJMMiA9XG4gICAgcHJvY2Vzcy5lbnYuU0hJUF9VUkwyIHx8XG4gICAgcHJvY2Vzcy5lbnYuVklURV9TSElQX1VSTDIgfHxcbiAgICAnaHR0cDovL2xvY2FsaG9zdDo4MDgwJztcbiAgY29uc29sZS5sb2coU0hJUF9VUkwyKTtcblxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmVcbiAgY29uc3QgYmFzZSA9IChtb2RlOiBzdHJpbmcpID0+IHtcbiAgICBpZiAobW9kZSA9PT0gJ21vY2snIHx8IG1vZGUgPT09ICdzdGFnaW5nJykge1xuICAgICAgcmV0dXJuICcnO1xuICAgIH1cblxuICAgIHJldHVybiAnL2FwcHMvZ3JvdXBzLyc7XG4gIH07XG5cbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lXG4gIGNvbnN0IHBsdWdpbnMgPSAobW9kZTogc3RyaW5nKTogUGx1Z2luT3B0aW9uW10gPT4ge1xuICAgIGlmIChtb2RlID09PSAnbW9jaycgfHwgbW9kZSA9PT0gJ3N0YWdpbmcnKSB7XG4gICAgICByZXR1cm4gW1xuICAgICAgICBiYXNpY1NzbCgpIGFzIFBsdWdpbixcbiAgICAgICAgcmVhY3Qoe1xuICAgICAgICAgIGpzeEltcG9ydFNvdXJjZTogJ0B3ZWxsZG9uZS1zb2Z0d2FyZS93aHktZGlkLXlvdS1yZW5kZXInLFxuICAgICAgICB9KSBhcyBQbHVnaW5PcHRpb25bXSxcbiAgICAgIF07XG4gICAgfVxuXG4gICAgcmV0dXJuIFtcbiAgICAgIHByb2Nlc3MuZW52LlNTTCA9PT0gJ3RydWUnID8gKGJhc2ljU3NsKCkgYXMgUGx1Z2luT3B0aW9uKSA6IG51bGwsXG4gICAgICB1cmJpdFBsdWdpbih7XG4gICAgICAgIGJhc2U6ICdncm91cHMnLFxuICAgICAgICB0YXJnZXQ6IG1vZGUgPT09ICdkZXYyJyA/IFNISVBfVVJMMiA6IFNISVBfVVJMLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXG4gICAgICB9KSBhcyBQbHVnaW5PcHRpb25bXSxcbiAgICAgIHJlYWN0KHtcbiAgICAgICAganN4SW1wb3J0U291cmNlOiAnQHdlbGxkb25lLXNvZnR3YXJlL3doeS1kaWQteW91LXJlbmRlcicsXG4gICAgICB9KSBhcyBQbHVnaW5PcHRpb25bXSxcbiAgICAgIHN2Z3Ioe1xuICAgICAgICBpbmNsdWRlOiAnKiovKi5zdmcnLFxuICAgICAgfSkgYXMgUGx1Z2luLFxuICAgICAgdGFtYWd1aVBsdWdpbih7XG4gICAgICAgIGNvbmZpZzogJy4vdGFtYWd1aS5jb25maWcudHMnLFxuICAgICAgICBwbGF0Zm9ybTogJ3dlYicsXG4gICAgICB9KSBhcyBQbHVnaW4sXG4gICAgICBWaXRlUFdBKHtcbiAgICAgICAgYmFzZTogJy9hcHBzL2dyb3Vwcy8nLFxuICAgICAgICBtYW5pZmVzdCxcbiAgICAgICAgaW5qZWN0UmVnaXN0ZXI6ICdpbmxpbmUnLFxuICAgICAgICByZWdpc3RlclR5cGU6ICdwcm9tcHQnLFxuICAgICAgICBzdHJhdGVnaWVzOiAnaW5qZWN0TWFuaWZlc3QnLFxuICAgICAgICBzcmNEaXI6ICdzcmMnLFxuICAgICAgICBmaWxlbmFtZTogJ3N3LnRzJyxcbiAgICAgICAgZGV2T3B0aW9uczoge1xuICAgICAgICAgIGVuYWJsZWQ6IG1vZGUgPT09ICdzdycsXG4gICAgICAgICAgdHlwZTogJ21vZHVsZScsXG4gICAgICAgIH0sXG4gICAgICAgIGluamVjdE1hbmlmZXN0OiB7XG4gICAgICAgICAgZ2xvYlBhdHRlcm5zOiBbJyoqLyoue2pzLGNzcyxodG1sLGljbyxwbmcsc3ZnfSddLFxuICAgICAgICAgIG1heGltdW1GaWxlU2l6ZVRvQ2FjaGVJbkJ5dGVzOiAxMDAwMDAwMDAsXG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICBdO1xuICB9O1xuXG4gIGNvbnN0IHJvbGx1cE9wdGlvbnMgPSB7XG4gICAgZXh0ZXJuYWw6XG4gICAgICBtb2RlID09PSAnbW9jaycgfHwgbW9kZSA9PT0gJ3N0YWdpbmcnXG4gICAgICAgID8gWyd2aXJ0dWFsOnB3YS1yZWdpc3Rlci9yZWFjdCddXG4gICAgICAgIDogLy8gVE9ETzogZmluZCB3b3JrYXJvdW5kIGZvciBpc3N1ZXMgd2l0aCBAdGFtYWd1aS9yZWFjdC1uYXRpdmUtc3ZnXG4gICAgICAgICAgWydAdXJiaXQvc2lnaWwtanMvZGlzdC9jb3JlJywgJ3JlYWN0LW5hdGl2ZS1zdmcnXSxcbiAgICBvdXRwdXQ6IHtcbiAgICAgIGhhc2hDaGFyYWN0ZXJzOiAnYmFzZTM2JyBhcyBhbnksXG4gICAgICBtYW51YWxDaHVua3M6IHtcbiAgICAgICAgbG9kYXNoOiBbJ2xvZGFzaCddLFxuICAgICAgICAnbG9kYXNoL2ZwJzogWydsb2Rhc2gvZnAnXSxcbiAgICAgICAgJ3VyYml0L2FwaSc6IFsnQHVyYml0L2FwaSddLFxuICAgICAgICAndXJiaXQvaHR0cC1hcGknOiBbJ0B1cmJpdC9odHRwLWFwaSddLFxuICAgICAgICAndXJiaXQvc2lnaWwtanMnOiBbJ0B1cmJpdC9zaWdpbC1qcyddLFxuICAgICAgICAnYW55LWFzY2lpJzogWydhbnktYXNjaWknXSxcbiAgICAgICAgJ3JlYWN0LWJlYXV0aWZ1bC1kbmQnOiBbJ3JlYWN0LWJlYXV0aWZ1bC1kbmQnXSxcbiAgICAgICAgJ2Vtb2ppLW1hcnQnOiBbJ2Vtb2ppLW1hcnQnXSxcbiAgICAgICAgJ3RpcHRhcC9jb3JlJzogWydAdGlwdGFwL2NvcmUnXSxcbiAgICAgICAgJ3RpcHRhcC9leHRlbnNpb24tcGxhY2Vob2xkZXInOiBbJ0B0aXB0YXAvZXh0ZW5zaW9uLXBsYWNlaG9sZGVyJ10sXG4gICAgICAgICd0aXB0YXAvZXh0ZW5zaW9uLWxpbmsnOiBbJ0B0aXB0YXAvZXh0ZW5zaW9uLWxpbmsnXSxcbiAgICAgICAgJ3JlYWN0LXZpcnR1b3NvJzogWydyZWFjdC12aXJ0dW9zbyddLFxuICAgICAgICAncmVhY3Qtc2VsZWN0JzogWydyZWFjdC1zZWxlY3QnXSxcbiAgICAgICAgJ3JlYWN0LWhvb2stZm9ybSc6IFsncmVhY3QtaG9vay1mb3JtJ10sXG4gICAgICAgICdmcmFtZXItbW90aW9uJzogWydmcmFtZXItbW90aW9uJ10sXG4gICAgICAgICdkYXRlLWZucyc6IFsnZGF0ZS1mbnMnXSxcbiAgICAgICAgJ3RpcHB5LmpzJzogWyd0aXBweS5qcyddLFxuICAgICAgICAnYXdzLXNkay9jbGllbnQtczMnOiBbJ0Bhd3Mtc2RrL2NsaWVudC1zMyddLFxuICAgICAgICAnYXdzLXNkay9zMy1yZXF1ZXN0LXByZXNpZ25lcic6IFsnQGF3cy1zZGsvczMtcmVxdWVzdC1wcmVzaWduZXInXSxcbiAgICAgICAgcmVmcmFjdG9yOiBbJ3JlZnJhY3RvciddLFxuICAgICAgICAndXJiaXQtb2InOiBbJ3VyYml0LW9iJ10sXG4gICAgICAgICdoYXN0LXRvLWh5cGVyc2NyaXB0JzogWydoYXN0LXRvLWh5cGVyc2NyaXB0J10sXG4gICAgICAgICdyYWRpeC11aS9yZWFjdC1kaWFsb2cnOiBbJ0ByYWRpeC11aS9yZWFjdC1kaWFsb2cnXSxcbiAgICAgICAgJ3JhZGl4LXVpL3JlYWN0LWRyb3Bkb3duLW1lbnUnOiBbJ0ByYWRpeC11aS9yZWFjdC1kcm9wZG93bi1tZW51J10sXG4gICAgICAgICdyYWRpeC11aS9yZWFjdC1wb3BvdmVyJzogWydAcmFkaXgtdWkvcmVhY3QtcG9wb3ZlciddLFxuICAgICAgICAncmFkaXgtdWkvcmVhY3QtdG9hc3QnOiBbJ0ByYWRpeC11aS9yZWFjdC10b2FzdCddLFxuICAgICAgICAncmFkaXgtdWkvcmVhY3QtdG9vbHRpcCc6IFsnQHJhZGl4LXVpL3JlYWN0LXRvb2x0aXAnXSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfTtcblxuICByZXR1cm4gZGVmaW5lQ29uZmlnKHtcbiAgICBiYXNlOiBiYXNlKG1vZGUpLFxuICAgIHNlcnZlcjoge1xuICAgICAgaG9zdDogJ2xvY2FsaG9zdCcsXG4gICAgICBwb3J0OiBwcm9jZXNzLmVudi5FMkVfUE9SVF8zMDAxID09PSAndHJ1ZScgPyAzMDAxIDogMzAwMCxcbiAgICAgIC8vTk9URSAgdGhlIHByb3h5IHVzZWQgYnkgdml0ZSBpcyB3cml0dGVuIHBvb3JseSwgYW5kIGVuZHMgdXAgcmVtb3ZpbmdcbiAgICAgIC8vICAgICAgZW1wdHkgcGF0aCBzZWdtZW50cyBmcm9tIHVybHM6IGh0dHAtcGFydHkvbm9kZS1odHRwLXByb3h5IzE0MjAuXG4gICAgICAvLyAgICAgIGFzIGEgd29ya2Fyb3VuZCBmb3IgdGhpcywgd2UgcmV3cml0ZSB0aGUgcGF0aCBnb2luZyBpbnRvIHRoZVxuICAgICAgLy8gICAgICBwcm94eSB0byBcImhpZGVcIiB0aGUgZW1wdHkgcGF0aCBzZWdtZW50cywgYW5kIHRoZW4gcmV3cml0ZSB0aGVcbiAgICAgIC8vICAgICAgcGF0aCBjb21pbmcgXCJvdXRcIiBvZiB0aGUgcHJveHkgdG8gb2J0YWluIHRoZSBvcmlnaW5hbCBwYXRoLlxuICAgICAgcHJveHk6IHtcbiAgICAgICAgJ14uKi8vLionOiB7XG4gICAgICAgICAgdGFyZ2V0OiBTSElQX1VSTCxcbiAgICAgICAgICByZXdyaXRlOiAocGF0aCkgPT4gcGF0aC5yZXBsYWNlQWxsKCcvLycsICcvQEBALycpLFxuICAgICAgICAgIGNvbmZpZ3VyZTogKHByb3h5KSA9PiB7XG4gICAgICAgICAgICBwcm94eS5vbigncHJveHlSZXEnLCAocHJveHlSZXEpID0+IHtcbiAgICAgICAgICAgICAgcHJveHlSZXEucGF0aCA9IHByb3h5UmVxLnBhdGgucmVwbGFjZUFsbCgnL0BAQC8nLCAnLy8nKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gICAgYnVpbGQ6XG4gICAgICBtb2RlICE9PSAncHJvZmlsZSdcbiAgICAgICAgPyB7XG4gICAgICAgICAgICBzb3VyY2VtYXA6IGZhbHNlLFxuICAgICAgICAgICAgcm9sbHVwT3B0aW9ucyxcbiAgICAgICAgICB9XG4gICAgICAgIDogKHtcbiAgICAgICAgICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgLi4ucm9sbHVwT3B0aW9ucyxcbiAgICAgICAgICAgICAgcGx1Z2luczogW1xuICAgICAgICAgICAgICAgIGFuYWx5emUoe1xuICAgICAgICAgICAgICAgICAgbGltaXQ6IDIwLFxuICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgIHZpc3VhbGl6ZXIoKSxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSBhcyBCdWlsZE9wdGlvbnMpLFxuICAgIHBsdWdpbnM6IHBsdWdpbnMobW9kZSksXG4gICAgcmVzb2x2ZToge1xuICAgICAgYWxpYXM6IHtcbiAgICAgICAgJ0AnOiBmaWxlVVJMVG9QYXRoKG5ldyBVUkwoJy4vc3JjJywgaW1wb3J0Lm1ldGEudXJsKSksXG4gICAgICB9LFxuICAgIH0sXG4gICAgb3B0aW1pemVEZXBzOiB7XG4gICAgICBlc2J1aWxkT3B0aW9uczoge1xuICAgICAgICAvLyBGaXggZm9yIHBvbHlmaWxsIGlzc3VlIHdpdGggQHRhbWFndWkvYW5pbWF0aW9ucy1tb3RpXG4gICAgICAgIGRlZmluZToge1xuICAgICAgICAgIGdsb2JhbDogJ2dsb2JhbFRoaXMnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICAgIHRlc3Q6IHtcbiAgICAgIGdsb2JhbHM6IHRydWUsXG4gICAgICBlbnZpcm9ubWVudDogJ2pzZG9tJyxcbiAgICAgIHNldHVwRmlsZXM6ICcuL3Rlc3Qvc2V0dXAudHMnLFxuICAgICAgZGVwczoge30sXG4gICAgICBpbmNsdWRlOiBbJyoqLyoudGVzdC57anMsbWpzLGNqcyx0cyxtdHMsY3RzLGpzeCx0c3h9J10sXG4gICAgICBzZXJ2ZXI6IHtcbiAgICAgICAgZGVwczoge1xuICAgICAgICAgIGlubGluZTogWydyZWFjdC10d2VldCddLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9KTtcbn07XG4iLCAie1xuICBcIm5hbWVcIjogXCJ0bG9uLXdlYlwiLFxuICBcInZlcnNpb25cIjogXCI1LjcuMFwiLFxuICBcInByaXZhdGVcIjogdHJ1ZSxcbiAgXCJzY3JpcHRzXCI6IHtcbiAgICBcInJ1YmVcIjogXCJ0c2MgLi9ydWJlL2luZGV4LnRzIC0tb3V0RGlyIC4vcnViZS9kaXN0ICYmIG5vZGUgLi9ydWJlL2Rpc3QvaW5kZXguanNcIixcbiAgICBcImJ1aWxkXCI6IFwidHNjICYmIHZpdGUgYnVpbGRcIixcbiAgICBcImJ1aWxkOm1vY2tcIjogXCJ0c2MgJiYgdml0ZSBidWlsZCAtLW1vZGUgc3RhZ2luZ1wiLFxuICAgIFwiYnVpbGQ6cHJvZmlsZVwiOiBcInRzYyAmJiB2aXRlIGJ1aWxkIC0tbW9kZSBwcm9maWxlXCIsXG4gICAgXCJjb3ZlcmFnZVwiOiBcImNyb3NzLWVudiBUWj1VVEMgdml0ZXN0IHJ1biAtLWNvdmVyYWdlXCIsXG4gICAgXCJkZXZcIjogXCJjcm9zcy1lbnYgU1NMPXRydWUgdml0ZVwiLFxuICAgIFwiZGV2Om5hdGl2ZVwiOiBcImNyb3NzLWVudiBBUFA9Y2hhdCB2aXRlIC0tbW9kZSBuYXRpdmUgLS1ob3N0XCIsXG4gICAgXCJkZXYtbm8tc3NsXCI6IFwidml0ZVwiLFxuICAgIFwiZGV2MlwiOiBcImNyb3NzLWVudiBTU0w9dHJ1ZSB2aXRlIC0tbW9kZSBkZXYyXCIsXG4gICAgXCJtdWx0aVwiOiBcImNyb3NzLWVudiBTU0w9dHJ1ZSBjb25jdXJyZW50bHkgXFxcInZpdGVcXFwiIFxcXCJ2aXRlIC0tbW9kZSBkZXYyXFxcIlwiLFxuICAgIFwiZGV2LXN3XCI6IFwidml0ZSAtLW1vZGUgc3dcIixcbiAgICBcImxpbnRcIjogXCJlc2xpbnQgc3JjL1wiLFxuICAgIFwibGludDpmaXhcIjogXCJlc2xpbnQgc3JjLyAtLWZpeCAtLXF1aWV0XCIsXG4gICAgXCJsaW50OmZvcm1hdFwiOiBcInByZXR0aWVyIHNyYy8gLS13cml0ZVwiLFxuICAgIFwibGludDphbGxcIjogXCJwbnBtIGxpbnQ6Zm9ybWF0ICYmIHBucG0gcnVuIGxpbnQ6Zml4XCIsXG4gICAgXCJsaW50OnN0YWdlZFwiOiBcImxpbnQtc3RhZ2VkXCIsXG4gICAgXCJtb2NrXCI6IFwidml0ZSAtLW1vZGUgbW9ja1wiLFxuICAgIFwic2VydmVcIjogXCJ2aXRlIHByZXZpZXdcIixcbiAgICBcInNlcnZlLXN3XCI6IFwidml0ZSBwcmV2aWV3IC0tbW9kZSBzd1wiLFxuICAgIFwidGVzdFwiOiBcImNyb3NzLWVudiBUWj1VVEMgdml0ZXN0XCIsXG4gICAgXCJlMmVcIjogXCJwbnBtIHJ1YmVcIixcbiAgICBcImUyZTpkZWJ1Zzp6b2RcIjogXCJjcm9zcy1lbnYgREVCVUdfUExBWVdSSUdIVD10cnVlIFNISVBfTkFNRT16b2QgcG5wbSBydW4gZTJlXCIsXG4gICAgXCJlMmU6ZGVidWc6YnVzXCI6IFwiY3Jvc3MtZW52IERFQlVHX1BMQVlXUklHSFQ9dHJ1ZSBTSElQX05BTUU9YnVzIHBucG0gcnVuIGUyZVwiLFxuICAgIFwiZTJlOmRlYnVnXCI6IFwiY3Jvc3MtZW52IERFQlVHX1BMQVlXUklHSFQ9dHJ1ZSBwbnBtIGUyZVwiLFxuICAgIFwidHNjXCI6IFwidHNjIC0tbm9FbWl0XCIsXG4gICAgXCJlMmU6Y29kZWdlblwiOiBcImNvbmN1cnJlbnRseSBcXFwicG5wbSBkZXYtbm8tc3NsXFxcIiBcXFwicG5wbSBleGVjIHBsYXl3cmlnaHQgY29kZWdlbiBodHRwOi8vbG9jYWxob3N0OjMwMDBcXFwiXCIsXG4gICAgXCJjb3Ntb3NcIjogXCJjb3Ntb3NcIlxuICB9LFxuICBcImxpbnQtc3RhZ2VkXCI6IHtcbiAgICBcIioue2pzLGpzeCx0cyx0c3h9XCI6IFtcbiAgICAgIFwicG5wbSBsaW50OmZpeFwiLFxuICAgICAgXCJwbnBtIGxpbnQ6Zm9ybWF0XCJcbiAgICBdXG4gIH0sXG4gIFwiZGVwZW5kZW5jaWVzXCI6IHtcbiAgICBcIkBhd3Mtc2RrL2NsaWVudC1zM1wiOiBcIl4zLjE5MC4wXCIsXG4gICAgXCJAYXdzLXNkay9zMy1yZXF1ZXN0LXByZXNpZ25lclwiOiBcIl4zLjE5MC4wXCIsXG4gICAgXCJAZW1vamktbWFydC9kYXRhXCI6IFwiXjEuMC42XCIsXG4gICAgXCJAZW1vamktbWFydC9yZWFjdFwiOiBcIl4xLjAuMVwiLFxuICAgIFwiQHJhZGl4LXVpL3JlYWN0LWFjY29yZGlvblwiOiBcIl4xLjEuMlwiLFxuICAgIFwiQHJhZGl4LXVpL3JlYWN0LWNvbGxhcHNpYmxlXCI6IFwiXjEuMC4zXCIsXG4gICAgXCJAcmFkaXgtdWkvcmVhY3QtZGlhbG9nXCI6IFwiXjEuMC40XCIsXG4gICAgXCJAcmFkaXgtdWkvcmVhY3QtZHJvcGRvd24tbWVudVwiOiBcIl4yLjAuNVwiLFxuICAgIFwiQHJhZGl4LXVpL3JlYWN0LXBvcG92ZXJcIjogXCJeMS4wLjJcIixcbiAgICBcIkByYWRpeC11aS9yZWFjdC1yYWRpby1ncm91cFwiOiBcIl4xLjEuM1wiLFxuICAgIFwiQHJhZGl4LXVpL3JlYWN0LXRhYnNcIjogXCJeMS4wLjRcIixcbiAgICBcIkByYWRpeC11aS9yZWFjdC10b2FzdFwiOiBcIl4xLjAuMFwiLFxuICAgIFwiQHJhZGl4LXVpL3JlYWN0LXRvZ2dsZVwiOiBcIl4xLjAuMlwiLFxuICAgIFwiQHJhZGl4LXVpL3JlYWN0LXRvZ2dsZS1ncm91cFwiOiBcIl4xLjAuNFwiLFxuICAgIFwiQHJhZGl4LXVpL3JlYWN0LXRvb2x0aXBcIjogXCJeMS4wLjBcIixcbiAgICBcIkB0YW1hZ3VpL3ZpdGUtcGx1Z2luXCI6IFwiMS45My4yXCIsXG4gICAgXCJAdGFuc3RhY2svcmVhY3QtcXVlcnlcIjogXCJeNC4yOC4wXCIsXG4gICAgXCJAdGFuc3RhY2svcmVhY3QtcXVlcnktZGV2dG9vbHNcIjogXCJeNC4yOC4wXCIsXG4gICAgXCJAdGFuc3RhY2svcmVhY3QtcXVlcnktcGVyc2lzdC1jbGllbnRcIjogXCJeNC4yOC4wXCIsXG4gICAgXCJAdGFuc3RhY2svcmVhY3QtdmlydHVhbFwiOiBcIl4zLjAuMC1iZXRhLjYwXCIsXG4gICAgXCJAdGlwdGFwL2NvcmVcIjogXCJeMi4wLjNcIixcbiAgICBcIkB0aXB0YXAvZXh0ZW5zaW9uLWJsb2NrcXVvdGVcIjogXCJeMi4wLjNcIixcbiAgICBcIkB0aXB0YXAvZXh0ZW5zaW9uLWJvbGRcIjogXCJeMi4wLjNcIixcbiAgICBcIkB0aXB0YXAvZXh0ZW5zaW9uLWJ1bGxldC1saXN0XCI6IFwiXjIuMC4zXCIsXG4gICAgXCJAdGlwdGFwL2V4dGVuc2lvbi1jb2RlXCI6IFwiXjIuMC4zXCIsXG4gICAgXCJAdGlwdGFwL2V4dGVuc2lvbi1jb2RlLWJsb2NrXCI6IFwiXjIuMC4zXCIsXG4gICAgXCJAdGlwdGFwL2V4dGVuc2lvbi1kb2N1bWVudFwiOiBcIl4yLjAuM1wiLFxuICAgIFwiQHRpcHRhcC9leHRlbnNpb24tZmxvYXRpbmctbWVudVwiOiBcIl4yLjAuM1wiLFxuICAgIFwiQHRpcHRhcC9leHRlbnNpb24taGFyZC1icmVha1wiOiBcIl4yLjAuM1wiLFxuICAgIFwiQHRpcHRhcC9leHRlbnNpb24taGVhZGluZ1wiOiBcIl4yLjAuM1wiLFxuICAgIFwiQHRpcHRhcC9leHRlbnNpb24taGlzdG9yeVwiOiBcIl4yLjAuM1wiLFxuICAgIFwiQHRpcHRhcC9leHRlbnNpb24taG9yaXpvbnRhbC1ydWxlXCI6IFwiXjIuMC4zXCIsXG4gICAgXCJAdGlwdGFwL2V4dGVuc2lvbi1pdGFsaWNcIjogXCJeMi4wLjNcIixcbiAgICBcIkB0aXB0YXAvZXh0ZW5zaW9uLWxpbmtcIjogXCJeMi4wLjNcIixcbiAgICBcIkB0aXB0YXAvZXh0ZW5zaW9uLWxpc3QtaXRlbVwiOiBcIl4yLjAuM1wiLFxuICAgIFwiQHRpcHRhcC9leHRlbnNpb24tbWVudGlvblwiOiBcIl4yLjAuM1wiLFxuICAgIFwiQHRpcHRhcC9leHRlbnNpb24tb3JkZXJlZC1saXN0XCI6IFwiXjIuMC4zXCIsXG4gICAgXCJAdGlwdGFwL2V4dGVuc2lvbi1wYXJhZ3JhcGhcIjogXCJeMi4wLjNcIixcbiAgICBcIkB0aXB0YXAvZXh0ZW5zaW9uLXBsYWNlaG9sZGVyXCI6IFwiXjIuMC4zXCIsXG4gICAgXCJAdGlwdGFwL2V4dGVuc2lvbi1zdHJpa2VcIjogXCJeMi4wLjNcIixcbiAgICBcIkB0aXB0YXAvZXh0ZW5zaW9uLXRhc2staXRlbVwiOiBcIl4yLjEuN1wiLFxuICAgIFwiQHRpcHRhcC9leHRlbnNpb24tdGFzay1saXN0XCI6IFwiXjIuMS43XCIsXG4gICAgXCJAdGlwdGFwL2V4dGVuc2lvbi10ZXh0XCI6IFwiXjIuMC4zXCIsXG4gICAgXCJAdGlwdGFwL3BtXCI6IFwiXjIuMC4zXCIsXG4gICAgXCJAdGlwdGFwL3JlYWN0XCI6IFwiXjIuMC4zXCIsXG4gICAgXCJAdGlwdGFwL3N1Z2dlc3Rpb25cIjogXCJeMi4wLjNcIixcbiAgICBcIkB0bG9uY29ycC9tb2NrLWh0dHAtYXBpXCI6IFwiXjEuMi4wXCIsXG4gICAgXCJAdGxvbmNvcnAvc2hhcmVkXCI6IFwid29ya3NwYWNlOipcIixcbiAgICBcIkB0bG9uY29ycC91aVwiOiBcIndvcmtzcGFjZToqXCIsXG4gICAgXCJAdHlwZXMvbWFya2VkXCI6IFwiXjQuMy4wXCIsXG4gICAgXCJAdXJiaXQvYXBpXCI6IFwiXjIuMi4wXCIsXG4gICAgXCJAdXJiaXQvYXVyYVwiOiBcIl4xLjAuMFwiLFxuICAgIFwiQHVyYml0L2h0dHAtYXBpXCI6IFwiXjMuMS4wLWRldi0yXCIsXG4gICAgXCJAdXJiaXQvc2lnaWwtanNcIjogXCJeMi4yLjBcIixcbiAgICBcImFueS1hc2NpaVwiOiBcIl4wLjMuMVwiLFxuICAgIFwiYmlnLWludGVnZXJcIjogXCJeMS42LjUxXCIsXG4gICAgXCJicm93c2VyLWNvb2tpZXNcIjogXCJeMS4yLjBcIixcbiAgICBcImJyb3dzZXItaW1hZ2UtY29tcHJlc3Npb25cIjogXCJeMi4wLjJcIixcbiAgICBcImNsYXNzbmFtZXNcIjogXCJeMi4zLjFcIixcbiAgICBcImNsaXBib2FyZC1jb3B5XCI6IFwiXjQuMC4xXCIsXG4gICAgXCJjb2xvcjJrXCI6IFwiXjIuMC4wXCIsXG4gICAgXCJjcm9zcy1mZXRjaFwiOiBcIl4zLjEuNVwiLFxuICAgIFwiZGF0ZS1mbnNcIjogXCJeMi4yOC4wXCIsXG4gICAgXCJkb21wdXJpZnlcIjogXCJeMy4wLjZcIixcbiAgICBcImVtb2ppLW1hcnRcIjogXCJeNS4yLjJcIixcbiAgICBcImVtb2ppLXJlZ2V4XCI6IFwiXjEwLjIuMVwiLFxuICAgIFwiZmFzdC1hdmVyYWdlLWNvbG9yXCI6IFwiXjkuMS4xXCIsXG4gICAgXCJmcmFtZXItbW90aW9uXCI6IFwiXjYuNS4xXCIsXG4gICAgXCJmdXp6eVwiOiBcIl4wLjEuM1wiLFxuICAgIFwiZ2V0LXlvdXR1YmUtaWRcIjogXCJeMS4wLjFcIixcbiAgICBcImhhc3QtdG8taHlwZXJzY3JpcHRcIjogXCJeMTAuMC4xXCIsXG4gICAgXCJoaXN0b3J5XCI6IFwiXjUuMy4wXCIsXG4gICAgXCJpZGIta2V5dmFsXCI6IFwiXjYuMi4wXCIsXG4gICAgXCJpbW1lclwiOiBcIl45LjAuMTJcIixcbiAgICBcImxvZGFzaFwiOiBcIl40LjE3LjIxXCIsXG4gICAgXCJtYXJrZWRcIjogXCJeNC4zLjBcIixcbiAgICBcIm1hc29uaWNcIjogXCJeMy42LjVcIixcbiAgICBcIm1vbWVudFwiOiBcIl4yLjI5LjRcIixcbiAgICBcInBvc3Rob2ctanNcIjogXCJeMS42OC4yXCIsXG4gICAgXCJwcmlzbWpzXCI6IFwiXjEuMjkuMFwiLFxuICAgIFwicHJvc2VtaXJyb3ItY29tbWFuZHNcIjogXCJ+MS4yLjJcIixcbiAgICBcInByb3NlbWlycm9yLWhpc3RvcnlcIjogXCJ+MS4yLjBcIixcbiAgICBcInByb3NlbWlycm9yLWtleW1hcFwiOiBcIn4xLjEuNVwiLFxuICAgIFwicHJvc2VtaXJyb3ItbWFya2Rvd25cIjogXCJeMS4xMS4xXCIsXG4gICAgXCJwcm9zZW1pcnJvci1tb2RlbFwiOiBcIn4xLjE2LjFcIixcbiAgICBcInByb3NlbWlycm9yLXNjaGVtYS1saXN0XCI6IFwifjEuMS42XCIsXG4gICAgXCJwcm9zZW1pcnJvci1zdGF0ZVwiOiBcIn4xLjMuNFwiLFxuICAgIFwicHJvc2VtaXJyb3ItdHJhbnNmb3JtXCI6IFwifjEuNC4yXCIsXG4gICAgXCJwcm9zZW1pcnJvci12aWV3XCI6IFwifjEuMjMuMTNcIixcbiAgICBcInJlYWN0XCI6IFwiXjE4LjIuMFwiLFxuICAgIFwicmVhY3QtYmVhdXRpZnVsLWRuZFwiOiBcIl4xMy4xLjFcIixcbiAgICBcInJlYWN0LWNvbG9yZnVsXCI6IFwiXjUuNS4xXCIsXG4gICAgXCJyZWFjdC1kbmRcIjogXCJeMTUuMS4xXCIsXG4gICAgXCJyZWFjdC1kbmQtaHRtbDUtYmFja2VuZFwiOiBcIl4xNS4xLjJcIixcbiAgICBcInJlYWN0LWRuZC10b3VjaC1iYWNrZW5kXCI6IFwiXjE1LjEuMVwiLFxuICAgIFwicmVhY3QtZG9tXCI6IFwiXjE4LjIuMFwiLFxuICAgIFwicmVhY3QtZXJyb3ItYm91bmRhcnlcIjogXCJeMy4xLjRcIixcbiAgICBcInJlYWN0LWhlbG1ldFwiOiBcIl42LjEuMFwiLFxuICAgIFwicmVhY3QtaG9vay1mb3JtXCI6IFwiXjcuMzAuMFwiLFxuICAgIFwicmVhY3QtaW1hZ2Utc2l6ZVwiOiBcIl4yLjAuMFwiLFxuICAgIFwicmVhY3QtaW50ZXJzZWN0aW9uLW9ic2VydmVyXCI6IFwiXjkuNC4wXCIsXG4gICAgXCJyZWFjdC1vZW1iZWQtY29udGFpbmVyXCI6IFwiZ2l0aHViOnN0ZWZrYW1wZW4vcmVhY3Qtb2VtYmVkLWNvbnRhaW5lclwiLFxuICAgIFwicmVhY3QtcXItY29kZVwiOiBcIl4yLjAuMTJcIixcbiAgICBcInJlYWN0LXJvdXRlclwiOiBcIl42LjIyLjFcIixcbiAgICBcInJlYWN0LXJvdXRlci1kb21cIjogXCJeNi4yMi4xXCIsXG4gICAgXCJyZWFjdC1zZWxlY3RcIjogXCJeNS4zLjJcIixcbiAgICBcInJlYWN0LXR3ZWV0XCI6IFwiXjMuMC40XCIsXG4gICAgXCJyZWFjdC12aXJ0dW9zb1wiOiBcIl40LjUuMVwiLFxuICAgIFwicmVmcmFjdG9yXCI6IFwiXjQuOC4wXCIsXG4gICAgXCJzbHVnaWZ5XCI6IFwiXjEuNi42XCIsXG4gICAgXCJzb3J0ZWQtYnRyZWVcIjogXCJeMS44LjFcIixcbiAgICBcInRhaWx3aW5kY3NzLW9wZW50eXBlXCI6IFwiXjEuMS4wXCIsXG4gICAgXCJ0YWlsd2luZGNzcy1zY29wZWQtZ3JvdXBzXCI6IFwiXjIuMC4wXCIsXG4gICAgXCJ0aXBweS5qc1wiOiBcIl42LjMuN1wiLFxuICAgIFwidXJiaXQtb2JcIjogXCJeNS4wLjFcIixcbiAgICBcInVzZS1wd2EtaW5zdGFsbFwiOiBcIl4xLjAuMVwiLFxuICAgIFwidXNlaG9va3MtdHNcIjogXCJeMi42LjBcIixcbiAgICBcInV1aWRcIjogXCJeOS4wLjBcIixcbiAgICBcInZhbGlkYXRvclwiOiBcIl4xMy43LjBcIixcbiAgICBcInZhdWxcIjogXCJnaXRodWI6bGF0dGVyLWJvbGRlbi92YXVsXCIsXG4gICAgXCJ2aWRlby1yZWFjdFwiOiBcIl4wLjE2LjBcIixcbiAgICBcInZpdGUtcGx1Z2luLXN2Z3JcIjogXCJeNC4yLjBcIixcbiAgICBcIndvcmtib3gtcHJlY2FjaGluZ1wiOiBcIl42LjUuNFwiLFxuICAgIFwienVzdGFuZFwiOiBcIl4zLjcuMlwiXG4gIH0sXG4gIFwiZGV2RGVwZW5kZW5jaWVzXCI6IHtcbiAgICBcIkBmYWtlci1qcy9mYWtlclwiOiBcIl44LjQuMVwiLFxuICAgIFwiQHBsYXl3cmlnaHQvdGVzdFwiOiBcIl4xLjMzLjBcIixcbiAgICBcIkB0YWlsd2luZGNzcy9hc3BlY3QtcmF0aW9cIjogXCJeMC40LjBcIixcbiAgICBcIkB0YWlsd2luZGNzcy9jb250YWluZXItcXVlcmllc1wiOiBcIl4wLjEuMFwiLFxuICAgIFwiQHRhaWx3aW5kY3NzL3R5cG9ncmFwaHlcIjogXCJeMC41LjdcIixcbiAgICBcIkB0ZXN0aW5nLWxpYnJhcnkvamVzdC1kb21cIjogXCJeNS4xNi40XCIsXG4gICAgXCJAdGVzdGluZy1saWJyYXJ5L3JlYWN0XCI6IFwiXjE0LjAuMFwiLFxuICAgIFwiQHRlc3RpbmctbGlicmFyeS91c2VyLWV2ZW50XCI6IFwiXjE0LjIuMFwiLFxuICAgIFwiQHR5cGVzL2RvbXB1cmlmeVwiOiBcIl4zLjAuNVwiLFxuICAgIFwiQHR5cGVzL2ZzLWV4dHJhXCI6IFwiXjExLjAuMVwiLFxuICAgIFwiQHR5cGVzL2xvZGFzaFwiOiBcIjQuMTQuMTgzXCIsXG4gICAgXCJAdHlwZXMvbm9kZVwiOiBcIl4yMC4xMC44XCIsXG4gICAgXCJAdHlwZXMvbm9kZS1mZXRjaFwiOiBcIl4yLjYuNFwiLFxuICAgIFwiQHR5cGVzL3BvcnRzY2FubmVyXCI6IFwiXjIuMS4xXCIsXG4gICAgXCJAdHlwZXMvcHJpc21qc1wiOiBcIl4xLjI2LjBcIixcbiAgICBcIkB0eXBlcy9xcmNvZGVcIjogXCJeMS41LjJcIixcbiAgICBcIkB0eXBlcy9yZWFjdFwiOiBcIl4xOC4yLjQ2XCIsXG4gICAgXCJAdHlwZXMvcmVhY3QtYmVhdXRpZnVsLWRuZFwiOiBcIl4xMy4xLjJcIixcbiAgICBcIkB0eXBlcy9yZWFjdC1kb21cIjogXCJeMTguMi43XCIsXG4gICAgXCJAdHlwZXMvcmVhY3QtaGVsbWV0XCI6IFwiXjYuMS41XCIsXG4gICAgXCJAdHlwZXMvcmVhY3QtdGVzdC1yZW5kZXJlclwiOiBcIl4xOC4wLjBcIixcbiAgICBcIkB0eXBlcy90YXItZnNcIjogXCJeMi4wLjFcIixcbiAgICBcIkB0eXBlcy91dWlkXCI6IFwiXjkuMC4yXCIsXG4gICAgXCJAdHlwZXMvdmFsaWRhdG9yXCI6IFwiXjEzLjcuMlwiLFxuICAgIFwiQHR5cGVzL3ZpZGVvLXJlYWN0XCI6IFwiXjAuMTUuMVwiLFxuICAgIFwiQHR5cGVzL3dzXCI6IFwiXjguNS4zXCIsXG4gICAgXCJAdXJiaXQvdml0ZS1wbHVnaW4tdXJiaXRcIjogXCJeMi4wLjFcIixcbiAgICBcIkB2aXRlanMvcGx1Z2luLWJhc2ljLXNzbFwiOiBcIl4xLjEuMFwiLFxuICAgIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3RcIjogXCJeNC4yLjFcIixcbiAgICBcIkB3ZWxsZG9uZS1zb2Z0d2FyZS93aHktZGlkLXlvdS1yZW5kZXJcIjogXCJeNy4wLjFcIixcbiAgICBcImF1dG9wcmVmaXhlclwiOiBcIl4xMC40LjRcIixcbiAgICBcImNvbmN1cnJlbnRseVwiOiBcIl44LjAuMVwiLFxuICAgIFwiY3Jvc3MtZW52XCI6IFwiXjcuMC4zXCIsXG4gICAgXCJmcy1leHRyYVwiOiBcIl4xMS4xLjFcIixcbiAgICBcImpzZG9tXCI6IFwiXjIzLjIuMFwiLFxuICAgIFwibGludC1zdGFnZWRcIjogXCJeMTUuMC4wXCIsXG4gICAgXCJtc3dcIjogXCJeMC40NC4yXCIsXG4gICAgXCJub2RlLWZldGNoXCI6IFwiXjIuNi4xMlwiLFxuICAgIFwicG9zdGNzc1wiOiBcIl44LjQuMTJcIixcbiAgICBcInBvc3Rjc3MtaW1wb3J0XCI6IFwiXjE0LjEuMFwiLFxuICAgIFwicHJldHRpZXJcIjogXCJeMy4xLjFcIixcbiAgICBcInJlYWN0LWNvc21vc1wiOiBcIjYuMS4xXCIsXG4gICAgXCJyZWFjdC1jb3Ntb3MtcGx1Z2luLXZpdGVcIjogXCI2LjEuMVwiLFxuICAgIFwicmVhY3QtdGVzdC1yZW5kZXJlclwiOiBcIl4xOC4yLjBcIixcbiAgICBcInJvbGx1cC1wbHVnaW4tYW5hbHl6ZXJcIjogXCJeNC4wLjBcIixcbiAgICBcInJvbGx1cC1wbHVnaW4tdmlzdWFsaXplclwiOiBcIl41LjYuMFwiLFxuICAgIFwidGFpbHdpbmRjc3NcIjogXCJeMy4yLjdcIixcbiAgICBcInRhaWx3aW5kY3NzLXRoZW1lLXN3YXBwZXJcIjogXCJeMC43LjNcIixcbiAgICBcInRhci1mc1wiOiBcIl4zLjAuNFwiLFxuICAgIFwidHNjLWZpbGVzXCI6IFwiXjEuMS40XCIsXG4gICAgXCJ2aXRlXCI6IFwiXjUuMS42XCIsXG4gICAgXCJ2aXRlLXBsdWdpbi1wd2FcIjogXCJeMC4xNy41XCIsXG4gICAgXCJ2aXRlc3RcIjogXCJeMC4zNC4xXCIsXG4gICAgXCJ3b3JrYm94LXdpbmRvd1wiOiBcIl43LjAuMFwiXG4gIH0sXG4gIFwibXN3XCI6IHtcbiAgICBcIndvcmtlckRpcmVjdG9yeVwiOiBcIi4vcHVibGljXCJcbiAgfVxufVxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvYnJpYW4vc3JjL3Rsb24vbW9uby9hcHBzL3Rsb24td2ViL3NyY1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL2JyaWFuL3NyYy90bG9uL21vbm8vYXBwcy90bG9uLXdlYi9zcmMvbWFuaWZlc3QudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL2JyaWFuL3NyYy90bG9uL21vbm8vYXBwcy90bG9uLXdlYi9zcmMvbWFuaWZlc3QudHNcIjtpbXBvcnQgeyBNYW5pZmVzdE9wdGlvbnMgfSBmcm9tICd2aXRlLXBsdWdpbi1wd2EnO1xuXG5jb25zdCBtYW5pZmVzdDogUGFydGlhbDxNYW5pZmVzdE9wdGlvbnM+ID0ge1xuICBuYW1lOiAnVGxvbicsXG4gIGRlc2NyaXB0aW9uOlxuICAgICdTdGFydCwgaG9zdCwgYW5kIGN1bHRpdmF0ZSBjb21tdW5pdGllcy4gT3duIHlvdXIgY29tbXVuaWNhdGlvbnMsIG9yZ2FuaXplIHlvdXIgcmVzb3VyY2VzLCBhbmQgc2hhcmUgZG9jdW1lbnRzLiBUbG9uIGlzIGEgcGVlci10by1wZWVyIGNvbGxhYm9yYXRpb24gdG9vbCBidWlsdCBvbiBVcmJpdCB0aGF0IHByb3ZpZGVzIGEgZmV3IHNpbXBsZSBiYXNpY3MgdGhhdCBjb21tdW5pdGllcyBjYW4gc2hhcGUgaW50byBzb21ldGhpbmcgdW5pcXVlIHRvIHRoZWlyIG5lZWRzLicsXG4gIHNob3J0X25hbWU6ICdUbG9uJyxcbiAgc3RhcnRfdXJsOiAnL2FwcHMvZ3JvdXBzJyxcbiAgc2NvcGU6ICcvYXBwcy9ncm91cHMnLFxuICBpZDogJy9hcHBzL2dyb3Vwcy8nLFxuICBpY29uczogW1xuICAgIHtcbiAgICAgIHNyYzogJy4vaWNvbi01MTIucG5nJyxcbiAgICAgIHNpemVzOiAnNTEyeDUxMicsXG4gICAgICB0eXBlOiAnaW1hZ2UvcG5nJyxcbiAgICB9LFxuICAgIHtcbiAgICAgIHNyYzogJy4vaWNvbi0xOTIucG5nJyxcbiAgICAgIHNpemVzOiAnMTkyeDE5MicsXG4gICAgICB0eXBlOiAnaW1hZ2UvcG5nJyxcbiAgICB9LFxuICAgIHtcbiAgICAgIHNyYzogJy4vaWNvbi01MTItbWFza2FibGUucG5nJyxcbiAgICAgIHNpemVzOiAnNTEyeDUxMicsXG4gICAgICB0eXBlOiAnaW1hZ2UvcG5nJyxcbiAgICAgIHB1cnBvc2U6ICdtYXNrYWJsZScsXG4gICAgfSxcbiAgICB7XG4gICAgICBzcmM6ICcuL2ljb24tMTkyLW1hc2thYmxlLnBuZycsXG4gICAgICBzaXplczogJzE5MngxOTInLFxuICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXG4gICAgICBwdXJwb3NlOiAnbWFza2FibGUnLFxuICAgIH0sXG4gIF0sXG4gIHRoZW1lX2NvbG9yOiAnI2ZmZmZmZicsXG4gIGJhY2tncm91bmRfY29sb3I6ICcjZmZmZmZmJyxcbiAgZGlzcGxheTogJ3N0YW5kYWxvbmUnLFxufTtcblxuZXhwb3J0IGRlZmF1bHQgbWFuaWZlc3Q7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQ0EsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxtQkFBbUI7QUFDNUIsT0FBTyxjQUFjO0FBQ3JCLE9BQU8sV0FBVztBQUNsQixPQUFPLGFBQWE7QUFDcEIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxxQkFBcUI7QUFDOUI7QUFBQSxFQUlFO0FBQUEsRUFDQTtBQUFBLE9BQ0s7QUFDUCxTQUFTLGVBQWU7QUFDeEIsT0FBTyxVQUFVOzs7QUNoQmpCO0FBQUEsRUFDRSxNQUFRO0FBQUEsRUFDUixTQUFXO0FBQUEsRUFDWCxTQUFXO0FBQUEsRUFDWCxTQUFXO0FBQUEsSUFDVCxNQUFRO0FBQUEsSUFDUixPQUFTO0FBQUEsSUFDVCxjQUFjO0FBQUEsSUFDZCxpQkFBaUI7QUFBQSxJQUNqQixVQUFZO0FBQUEsSUFDWixLQUFPO0FBQUEsSUFDUCxjQUFjO0FBQUEsSUFDZCxjQUFjO0FBQUEsSUFDZCxNQUFRO0FBQUEsSUFDUixPQUFTO0FBQUEsSUFDVCxVQUFVO0FBQUEsSUFDVixNQUFRO0FBQUEsSUFDUixZQUFZO0FBQUEsSUFDWixlQUFlO0FBQUEsSUFDZixZQUFZO0FBQUEsSUFDWixlQUFlO0FBQUEsSUFDZixNQUFRO0FBQUEsSUFDUixPQUFTO0FBQUEsSUFDVCxZQUFZO0FBQUEsSUFDWixNQUFRO0FBQUEsSUFDUixLQUFPO0FBQUEsSUFDUCxpQkFBaUI7QUFBQSxJQUNqQixpQkFBaUI7QUFBQSxJQUNqQixhQUFhO0FBQUEsSUFDYixLQUFPO0FBQUEsSUFDUCxlQUFlO0FBQUEsSUFDZixRQUFVO0FBQUEsRUFDWjtBQUFBLEVB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
