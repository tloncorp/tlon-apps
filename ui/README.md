# homestead/ui

## Preview

https://tlon-homestead.vercel.app/

## Development

Requires a local fake ship with homestead desk installed ([guide](./DEVELOPMENT.md))

```
npm run dev
```

## Mock

Uses fake data to show a UI mockup

```
npm run mock
```

## Cosmos

Run cosmos: 
```
npm run cosmos
```

### Fixtures

[Fixtures – Cosmos Docs](https://github.com/react-cosmos/react-cosmos/blob/main/docs/usage/fixtures.md)  

Cosmos uses fixture files to generate component previews. You can create fixture files in two ways (from the docs).
1. End fixture file names with `.fixture.{js,jsx,ts,tsx,md,mdx}.`
2. Put fixture files inside   `__fixtures__`.

Fixture files and folders can be nested at any level under `/src`.

### Decorators

[Decorators – Cosmos Docs](https://github.com/react-cosmos/react-cosmos/blob/main/docs/usage/decorators.md)

Many components need to be wrapped with providers or other context to work properly. Cosmos uses a `cosmos.decorator.tsx` files to share wrappers between components. From the Cosmos docs:

> A decorator only applies to fixture files contained in the decorator's directory. Decorators can be composed, in the order of their position in the file system hierarchy (from outer to inner).

### How it works

Cosmos runs two servers: a UI wrapper on port `5000`, and a renderer on port `5050`. The wrapper renders the Cosmos UI, and the renderer renders the actual component previews in an environment that's very close to our standard application environment.

Our setup uses `react-cosmos-plugin-vite` to configure the renderer. When you start cosmos, it evaluates our vite configuration file, does some module rewiring to replace our `main.ts` file with its own, and spins up a wrapped vite dev server on a new port.

[Cosmos Docs](https://github.com/react-cosmos/react-cosmos/blob/main/docs/README.md#getting-started)


