import { execFile, execFileSync, spawn } from 'node:child_process';
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  openSync,
  closeSync,
  rmSync,
} from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../../', import.meta.url));
export const out = process.env.QA_DIR || path.join(root, 'artifacts/agent-qa');
export const repo = 'tloncorp/tlon-apps';
export const project = '617bb643-5bf6-4c40-8af6-c6e9dd7e3bd0';
export const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
export function save(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(
    file,
    typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  );
}
export function command(bin, args, options = {}) {
  try {
    return execFileSync(bin, args, {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 120000,
      maxBuffer: 16 * 1024 * 1024,
      ...options,
    }).trim();
  } catch (error) {
    throw new Error(
      `${path.basename(bin)} failed (${error.status || error.code}); ${String(error.stderr || '').slice(-1500)}`
    );
  }
}
// Device commands must leave the event loop free to serve the local ship proxy.
export async function commandAsync(bin, args, options = {}) {
  try {
    const { stdout } = await promisify(execFile)(bin, args, {
      cwd: root,
      encoding: 'utf8',
      timeout: 120000,
      maxBuffer: 16 * 1024 * 1024,
      ...options,
    });
    return stdout.trim();
  } catch (error) {
    throw new Error(
      `${path.basename(bin)} failed (${error.code}); ${String(error.stderr || '').slice(-1500)}`
    );
  }
}
export function verifySource(head, candidate = 'HEAD', cwd = root) {
  if (!/^[a-f0-9]{40}$/.test(head)) throw new Error('Missing PR commit');
  const changed = command('git', ['diff', '--name-only', head, candidate], {
    cwd,
  })
    .split('\n')
    .filter(Boolean);
  if (
    changed.some(
      (file) =>
        !/^(scripts\/agent-qa\/|\.agents\/skills\/tlon-workflow\/|\.maestro\/cloud-fakeship\/|apps\/tlon-mobile\/\.eas\/workflows\/pr-agent-qa-ios.yml$|docs\/tlon-apps\/pr-agent-qa.md$)/.test(
          file
        )
    )
  )
    throw new Error(
      'Build or checkout differs from the requested product source'
    );
}
export const object = (properties) => ({
  type: 'object',
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});
export const text = { type: 'string' };
export const strings = { type: 'array', items: text };
export const deviceTools = [
  'snapshot',
  'screenshot',
  'home',
  'open',
  'press',
  'click',
  'longpress',
  'fill',
  'type',
  'scroll',
  'swipe',
  'back',
  'keyboard',
  'alert',
  'wait',
  'get',
  'is',
  'find',
  'help',
];
export function modelArgs({ name, cwd, schema, device }) {
  return [
    'exec',
    '--model',
    'openai/gpt-5.6-sol',
    '--json',
    '--ephemeral',
    '--ignore-user-config',
    '--ignore-rules',
    '--skip-git-repo-check',
    '--sandbox',
    name === 'assessment' ? 'read-only' : 'workspace-write',
    '--cd',
    cwd,
    '--output-last-message',
    path.join(out, `${name}.txt`),
    ...(schema
      ? ['--output-schema', path.join(out, `${name}.schema.json`)]
      : []),
    ...Object.entries({
      model_provider: 'openrouter',
      'model_providers.openrouter.name': 'OpenRouter',
      'model_providers.openrouter.base_url': 'https://openrouter.ai/api/v1',
      'model_providers.openrouter.env_key': 'OPENROUTER_API_KEY',
      'model_providers.openrouter.wire_api': 'responses',
      model_reasoning_effort: 'high',
      approval_policy: 'never',
      web_search: 'disabled',
      project_doc_max_bytes: 0,
      'features.shell_tool': !device,
      'features.apps': false,
      'features.multi_agent': false,
      ...(device
        ? {
            'mcp_servers.device.command': 'agent-device',
            'mcp_servers.device.args': ['mcp'],
            'mcp_servers.device.required': true,
            'mcp_servers.device.enabled_tools': deviceTools,
            'mcp_servers.device.default_tools_approval_mode': 'approve',
            'mcp_servers.device.startup_timeout_sec': 120,
            'mcp_servers.device.env_vars': Object.keys(device),
          }
        : {}),
    }).flatMap(([key, value]) => ['-c', `${key}=${JSON.stringify(value)}`]),
    '-',
  ];
}
export async function model(
  name,
  prompt,
  { cwd = out, schema, device, minutes = 6 } = {}
) {
  mkdirSync(path.join(out, `codex-${name}`), { recursive: true });
  save(path.join(out, `${name}-prompt.txt`), prompt);
  if (schema) save(path.join(out, `${name}.schema.json`), schema);
  const log = openSync(path.join(out, `${name}.jsonl`), 'w');
  const errors = openSync(path.join(out, `${name}.stderr`), 'w');
  try {
    await new Promise((resolve, reject) => {
      const child = spawn('codex', modelArgs({ name, cwd, schema, device }), {
        cwd,
        detached: true,
        stdio: ['pipe', log, errors],
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          TMPDIR: process.env.TMPDIR,
          OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
          CODEX_HOME: path.join(out, `codex-${name}`),
          ...device,
        },
      });
      const timer = setTimeout(() => {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {}
      }, minutes * 60000);
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        code === 0
          ? resolve()
          : reject(new Error(`${name} stopped; see saved Codex logs`));
      });
      child.stdin.on('error', () => {});
      child.stdin.end(prompt);
    });
  } finally {
    closeSync(log);
    closeSync(errors);
    rmSync(path.join(out, `codex-${name}`), { recursive: true, force: true });
  }
  const result = readFileSync(path.join(out, `${name}.txt`), 'utf8');
  return schema ? JSON.parse(result) : result;
}
