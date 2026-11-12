#!/usr/bin/env node
// Receives diagnostics timelines posted from the simulator and writes each to
// a file, so a long timeline never has to pass through a debugger result.
//
//   node scripts/scroll-hunt/collect.mjs <dir> [port]
//
// From the app's debugger:
//   fetch('http://localhost:8799/open-1', { method: 'POST',
//     body: JSON.stringify(__scrollDiag.events()) })
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

const [dir, port = '8799'] = process.argv.slice(2);
if (!dir) {
  console.error('usage: collect.mjs <dir> [port]');
  process.exit(1);
}
mkdirSync(dir, { recursive: true });

createServer((request, response) => {
  const name = path.basename(request.url ?? 'timeline') || 'timeline';
  const chunks = [];
  request.on('data', (chunk) => chunks.push(chunk));
  request.on('end', () => {
    const file = path.join(dir, `${name}.json`);
    writeFileSync(file, Buffer.concat(chunks));
    console.log(`wrote ${file}`);
    response.end('ok');
  });
}).listen(Number(port), '127.0.0.1', () =>
  console.log(`collecting timelines into ${dir} on port ${port}`)
);
