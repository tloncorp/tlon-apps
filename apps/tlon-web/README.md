# homestead/ui

## Development

Requires a local fake ship with homestead desk installed ([guide](./DEVELOPMENT.md))

From the root directory of `tlon-apps`, run:

```
npm install
```

If you need to specify a local dev ship on a URL other than `http://localhost:8080`, make a `.env.local` file in the `tlon-web` directory.

It should look like this:

```
VITE_SHIP_URL=http://localhost # (or whatever url you need, including livenet ships)
VITE_SHIP_URL2=http://localhost # (secondary ship if you intend to run two dev servers concurrently)
```

and then, either:

```
npm run dev:web
```

or

```
npm run dev --prefix ./apps/tlon-web
```

Or, from the `tlon-web` directory:

```
npm run dev
```

## Mock

Uses fake data to show a UI mockup, run from the `tlon-web` directory

```
npm run mock
```
