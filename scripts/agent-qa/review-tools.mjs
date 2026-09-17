import { videoReader, videoTools } from './video-tools.mjs';
import { readFileSync, appendFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';

const schema = (properties, required = Object.keys(properties)) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
const text = { type: 'string' };
export const evidenceTools = [
  {
    name: 'list_actions',
    description:
      'List recorded device actions and screenshot availability in chronological order.',
    inputSchema: schema({}),
  },
  {
    name: 'inspect_action',
    description:
      'Read an action, its resulting accessibility observations, and its screenshot. Compare the preceding and following actions to distinguish focus, typing and deliberate gestures.',
    inputSchema: schema({ index: { type: 'integer' } }),
  },
];
export function readActions(file) {
  const actions = [],
    pending = new Map();
  for (const line of readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
    const { type, item, at } = JSON.parse(line);
    if (item?.type !== 'mcp_tool_call' || item.server !== 'device') continue;
    let action = pending.get(item.id);
    if (!action) {
      action = {
        index: actions.length + 1,
        at,
        name: item.tool,
        arguments: item.arguments,
        content: [],
        responseReceived: false,
        isError: false,
      };
      pending.set(item.id, action);
      actions.push(action);
    }
    if (type === 'item.completed') {
      action.content = item.result?.content || [];
      action.responseReceived = true;
      action.isError = Boolean(
        item.error || item.result?.isError || item.status === 'failed'
      );
    }
  }
  return actions;
}
export function hasActionEvidence(action) {
  return (
    action?.responseReceived === true &&
    !action.isError &&
    action.content.some((c) =>
      c.type === 'text'
        ? typeof c.text === 'string' && Boolean(c.text.trim())
        : c.type === 'image' && typeof c.data === 'string' && c.data.length > 0
    )
  );
}
export function evidenceCall(actions, name, args) {
  if (name === 'list_actions')
    return [
      {
        type: 'text',
        text: JSON.stringify(
          actions.map(({ content, ...a }) => ({
            ...a,
            screenshot: content.some((c) => c.type === 'image'),
          }))
        ),
      },
    ];
  if (
    name !== 'inspect_action' ||
    !Number.isInteger(args.index) ||
    !actions[args.index - 1]
  )
    throw new Error('Unknown evidence action');
  const { content, ...action } = actions[args.index - 1];
  return [
    { type: 'text', text: JSON.stringify(action) },
    ...content
      .filter((c) => c.type === 'text')
      .map((c) => ({ type: 'text', text: c.text.slice(0, 16000) })),
    ...content.filter((c) => c.type === 'image').slice(0, 1),
  ];
}
async function main() {
  const actions = readActions(process.env.QA_EVIDENCE_TRACE);
  const video = process.env.QA_EVIDENCE_VIDEO
    ? videoReader({
        file: process.env.QA_EVIDENCE_VIDEO,
        outputDir: process.env.QA_VIDEO_FRAMES,
        startedAt: Number(process.env.QA_VIDEO_STARTED_AT) || null,
        actions,
      })
    : null;
  let calls = 0;
  for await (const line of createInterface({ input: process.stdin })) {
    let m;
    try {
      m = JSON.parse(line);
    } catch {
      continue;
    }
    if (m.id === undefined) continue;
    let result;
    if (m.method === 'initialize')
      result = {
        protocolVersion: m.params.protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: 'qa-read-only-review', version: '1' },
      };
    else if (m.method === 'ping') result = {};
    else if (m.method === 'tools/list')
      result = {
        tools: [...evidenceTools, ...(video ? videoTools : [])],
      };
    else if (m.method === 'tools/call') {
      try {
        if (++calls > 80)
          throw new Error('Review reached its 80-tool-call limit');
        const content =
          video && videoTools.some((t) => t.name === m.params.name)
            ? video.call(m.params.name, m.params.arguments)
            : evidenceCall(actions, m.params.name, m.params.arguments);
        result = { content };
        appendFileSync(
          process.env.QA_REVIEW_TRACE,
          JSON.stringify({
            tool: m.params.name,
            arguments: m.params.arguments,
          }) + '\n'
        );
      } catch (e) {
        result = {
          isError: true,
          content: [{ type: 'text', text: e.message }],
        };
      }
    } else {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: m.id,
          error: { code: -32601, message: 'Unknown method' },
        }) + '\n'
      );
      continue;
    }
    process.stdout.write(
      JSON.stringify({ jsonrpc: '2.0', id: m.id, result }) + '\n'
    );
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
