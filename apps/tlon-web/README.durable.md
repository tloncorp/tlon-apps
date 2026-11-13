# Durable mode

Durable mode is a build of this web client that talks to a Slab server instead
of an Urbit ship. The screens are the normal Tlon Messenger UI; only the
transport, sync and sign-in differ.

## How it talks to the server

- HTTP requests go to `/v1` on the page's origin, or on the server of an
  account added from another host.
- Each request carries the account's session as a bearer token
  (`Authorization: Bearer <session>`).
- Live updates arrive over one websocket per tab at `/v1/events`.
- Sign-in creates an account (`POST /v1/accounts`) or opens a saved one. Saved
  sessions live in the browser's local storage under `slab.identities` and
  `slab.activeIdentity`; `?identities=1` opens the account chooser.
- The browser cache is in memory, per tab. Requests to other origins are
  refused (`src/durable/localOnly.ts`), and Sentry and PostHog are not started.

## Building

From `apps/tlon-web`:

```bash
node ../../node_modules/vite/bin/vite.js build --mode durable --outDir <dir>
```

The Slab server serves `<dir>` through its web-directory setting; open
`/apps/groups/` on the server. For development, `pnpm dev:durable` runs Vite
on port 5173 and proxies `/v1` (including the websocket) to
`DURABLE_BACKEND_URL`, default `http://127.0.0.1:3001`.

## Where the code lives

- `packages/api/src/client/durable*.ts`: the HTTP client, the events
  connection and the conversion of server records to app models.
  `messageSearch.ts` makes the message search request.
- `packages/shared/src/store/durable*.ts`: sync from the server into the local
  database.
- `apps/tlon-web/src/durable/`: sign-in and account switching
  (`bootstrap.tsx`), the app shell (`App.tsx`) and the origin guard
  (`localOnly.ts`).
- `packages/app` and other store modules branch on `getDurableClient()` where
  the server behaves differently from a ship.
