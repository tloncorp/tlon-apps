# @tloncorp/api

TypeScript API client for Tlon/Urbit applications.

## Install

```bash
npm install @tloncorp/api
```

## Usage

```ts
import { configureClient, getGroups } from '@tloncorp/api';

await configureClient({
  shipName: 'zod',
  shipUrl: 'https://zod.example.com',
  getCode: async () => 'lidlut-tabwed-pillex-ridrup',
});

const groups = await getGroups();
```

## Publishing (maintainers)

```bash
pnpm --filter @tloncorp/api prepack
cd packages/api/dist
npm publish --access public --provenance
```
