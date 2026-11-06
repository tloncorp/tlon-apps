// tests/preload.ts
// Tests spawn `bun run src/main.ts`; a cold start can exceed bun's 5 s default. bunfig's [test] has no timeout key
// in this bun version (checked: it is ignored), so the default is raised here.
import { setDefaultTimeout } from 'bun:test';
setDefaultTimeout(20_000);
