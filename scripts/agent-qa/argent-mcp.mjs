import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { appendFileSync } from 'node:fs';
import { allowArgentCall } from './codex.mjs';

// Codex has the API credential; its device server must not inherit it.
const env = Object.fromEntries(
  [
    'PATH',
    'HOME',
    'TMPDIR',
    'DEVELOPER_DIR',
    'LANG',
    'ARGENT_SIMULATOR_NO_WINDOW',
    'ARGENT_SCREENSHOT_SCALE',
  ]
    .filter((key) => process.env[key])
    .map((key) => [key, process.env[key]])
);
const child = spawn('argent', ['mcp'], {
  env,
  stdio: ['pipe', 'pipe', 'inherit'],
});
let calls = 0;
const log = (entry) =>
  appendFileSync(process.env.QA_ARGENT_TRACE, JSON.stringify(entry) + '\n');
const input = createInterface({ input: process.stdin });
input.on('line', (line) => {
  const message = JSON.parse(line);
  if (message.method === 'tools/call') {
    try {
      allowArgentCall(
        message.params,
        process.env.QA_DEVICE_UDID,
        process.env.QA_DEVICE_APP_ID,
        ++calls
      );
    } catch (error) {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            isError: true,
            content: [{ type: 'text', text: error.message }],
          },
        }) + '\n'
      );
      return;
    }
    log({ at: new Date().toISOString(), type: 'request', ...message });
  }
  child.stdin.write(line + '\n');
});
input.on('close', () => child.stdin.end());
createInterface({ input: child.stdout }).on('line', (line) => {
  const message = JSON.parse(line);
  if (message.result?.content)
    log({ at: new Date().toISOString(), type: 'response', ...message });
  process.stdout.write(line + '\n');
});
child.on('error', () => process.exit(1));
child.on('exit', (code) => process.exit(code ?? 1));
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => child.kill(signal));
