import crypto from 'node:crypto';
import http from 'node:http';

const TLON_TEST_KEY_RE = /\[tlon-test:([a-zA-Z0-9_.:-]+)\]/g;
const MAX_REGISTRATION_HISTORY = 500;
const MAX_SUMMARY_TEXT_LENGTH = 300;

export function createFakeModelServer() {
  const state = {
    scripts: new Map(),
    callCounts: new Map(),
    allowExtraCalls: new Map(),
    receivedCalls: [],
    epoch: 0,
    lastRegistration: new Map(),
  };

  const server = http.createServer(async (req, res) => {
    try {
      await handleRequest(state, req, res);
    } catch (error) {
      sendJson(res, 500, {
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  });

  server.on('error', (err) => {
    console.error('[fake-model] server error:', err);
  });

  return {
    server,

    listen(options = {}) {
      const port = options.port ?? 4000;
      const host = options.host ?? '127.0.0.1';
      return new Promise((resolve, reject) => {
        const onError = (error) => {
          server.off('listening', onListening);
          reject(error);
        };
        const onListening = () => {
          server.off('error', onError);
          const address = server.address();
          if (!address || typeof address === 'string') {
            reject(new Error('fake-model server did not bind to a TCP port'));
            return;
          }
          const baseHost =
            host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
          resolve({
            baseUrl: `http://${formatHostForUrl(baseHost)}:${address.port}`,
            port: address.port,
            close: () => closeServer(server),
          });
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port, host);
      });
    },

    close() {
      return closeServer(server);
    },
  };
}

async function handleRequest(state, req, res) {
  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && req.url === '/v1/models') {
    sendJson(res, 200, {
      object: 'list',
      data: [
        { id: 'tlon-test-scripted', object: 'model', owned_by: 'tlon-tests' },
      ],
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/v1/_scripts') {
    const body = await readJson(req);
    const { key, steps } = body ?? {};
    const extra = body?.allowExtraCalls ?? 0;
    const validation = validateScript(key, steps, extra);
    if (validation) {
      sendJson(res, 400, { error: { message: validation } });
      return;
    }
    state.scripts.set(key, steps);
    state.callCounts.set(key, 0);
    state.allowExtraCalls.set(key, extra);
    recordRegistration(state, key);
    console.log(
      `[fake-model] registered script "${key}" with ${steps.length} step(s)` +
        (extra > 0 ? ` (+${extra} extra)` : '') +
        ` (epoch ${state.epoch})`
    );
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'DELETE' && req.url === '/v1/_scripts') {
    state.scripts.clear();
    state.callCounts.clear();
    state.allowExtraCalls.clear();
    state.receivedCalls.length = 0;
    state.epoch += 1;
    console.log(
      `[fake-model] cleared all scripts and received-call log (epoch -> ${state.epoch})`
    );
    sendJson(res, 200, { ok: true, epoch: state.epoch });
    return;
  }

  if (req.method === 'GET' && req.url?.startsWith('/v1/_received')) {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    const filterKey = url.searchParams.get('key');
    const calls = filterKey
      ? state.receivedCalls.filter((c) => c.key === filterKey)
      : state.receivedCalls.slice();
    sendJson(res, 200, { calls, count: calls.length, epoch: state.epoch });
    return;
  }

  if (req.method === 'POST' && req.url === '/v1/chat/completions') {
    await handleChatCompletion(state, req, res);
    return;
  }

  sendJson(res, 404, {
    error: {
      message: `Unhandled fake model route: ${req.method} ${req.url}`,
    },
  });
}

async function handleChatCompletion(state, req, res) {
  const body = await readJson(req);
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const streamFlag = body.stream === true ? ' stream=true' : '';
  const userText = messages
    .filter((message) => message?.role === 'user')
    .map((message) => extractText(message?.content))
    .filter(Boolean)
    .join('\n');

  const latestUserKey = extractTagFromLastUserTurn(messages);
  const historicalKey = extractLatestScriptKey(messages);
  let key = null;
  let provenance = 'none';
  if (latestUserKey) {
    key = latestUserKey;
    provenance = 'latest-user';
  } else if (historicalKey && state.scripts.has(historicalKey)) {
    key = historicalKey;
    provenance = 'history-active';
  } else if (historicalKey) {
    key = historicalKey;
    provenance = 'history-inactive';
  }

  const registeredEpoch =
    key && state.lastRegistration.has(key)
      ? state.lastRegistration.get(key).epoch
      : null;
  const stale = registeredEpoch !== null && state.epoch > registeredEpoch;
  const toolMetadata = extractAdvertisedToolMetadata(body);

  const callRecord = {
    key,
    at: Date.now(),
    model: body.model ?? null,
    stream: body.stream === true,
    messageCount: messages.length,
    userText,
    messages: summarizeRequestMessages(messages),
    ...toolMetadata,
    epoch: state.epoch,
    registeredEpoch,
    stale,
    provenance,
    responseToolCalls: [],
  };
  state.receivedCalls.push(callRecord);

  if (!key) {
    console.log(
      `[fake-model] POST /v1/chat/completions model=${body.model}${streamFlag} -> 400 (no [tlon-test:KEY] tag)`
    );
    sendJson(res, 400, {
      error: {
        message:
          'no [tlon-test:KEY] tag found in messages; register a script and tag the prompt before sending',
      },
    });
    return;
  }

  const steps = state.scripts.get(key);
  if (!steps) {
    if (stale && provenance === 'history-inactive') {
      console.log(
        `[fake-model] key="${key}"${streamFlag} -> 200 STALE-BENIGN (registeredEpoch=${registeredEpoch} arrivedEpoch=${state.epoch}, provenance=${provenance})`
      );
      respondScripted(res, body, benignFiller());
      return;
    }
    console.log(
      `[fake-model] POST /v1/chat/completions key="${key}"${streamFlag} -> 400 (no script registered)`
    );
    sendJson(res, 400, {
      error: { message: `no fake-model script registered for "${key}"` },
    });
    return;
  }

  const n = state.callCounts.get(key) ?? 0;
  if (n >= steps.length) {
    const extra = state.allowExtraCalls.get(key) ?? 0;
    if (n < steps.length + extra) {
      console.log(
        `[fake-model] key="${key}"${streamFlag} -> 200 EXTRA call ${n + 1} (of ${steps.length}+${extra})`
      );
      state.callCounts.set(key, n + 1);
      respondScripted(res, body, benignFiller());
      return;
    }
    console.log(
      `[fake-model] POST /v1/chat/completions key="${key}"${streamFlag} -> 400 (script exhausted: call ${n + 1} of ${steps.length})`
    );
    sendJson(res, 400, {
      error: {
        message: `fake-model script "${key}" exhausted: call ${n + 1} of ${steps.length} step(s)`,
      },
    });
    return;
  }

  state.callCounts.set(key, n + 1);
  const step = steps[n];
  const scripted =
    step.kind === 'tool_call'
      ? toolCallResponse({ name: step.name, args: step.args })
      : textResponse(step.content);
  callRecord.responseToolCalls = summarizeToolCalls(
    scripted.message.tool_calls ?? []
  );

  console.log(
    `[fake-model] POST /v1/chat/completions key="${key}"${streamFlag} -> 200 step ${n + 1}/${steps.length} (${step.kind}) [${provenance}]`
  );

  respondScripted(res, body, scripted);
}

function recordRegistration(state, key) {
  if (
    !state.lastRegistration.has(key) &&
    state.lastRegistration.size >= MAX_REGISTRATION_HISTORY
  ) {
    const oldest = state.lastRegistration.keys().next().value;
    if (oldest !== undefined) {
      state.lastRegistration.delete(oldest);
    }
  }
  state.lastRegistration.set(key, { epoch: state.epoch });
}

export function extractAdvertisedToolMetadata(body) {
  const toolNames = [];
  const seen = new Set();
  const add = (name) => {
    if (typeof name !== 'string' || name.length === 0 || seen.has(name)) {
      return;
    }
    seen.add(name);
    toolNames.push(name);
  };

  if (body && typeof body === 'object') {
    if (Array.isArray(body.tools)) {
      for (const tool of body.tools) {
        add(tool?.function?.name);
        add(tool?.name);
      }
    }
    if (Array.isArray(body.functions)) {
      for (const fn of body.functions) {
        add(fn?.name);
      }
    }
  }

  const hasToolChoice =
    body &&
    typeof body === 'object' &&
    Object.prototype.hasOwnProperty.call(body, 'tool_choice');

  return {
    toolNames,
    toolCount: toolNames.length,
    toolChoice: hasToolChoice ? body.tool_choice : null,
  };
}

function validateScript(key, steps, extra) {
  if (typeof key !== 'string' || key.length === 0) {
    return "missing or invalid 'key' (must be non-empty string)";
  }
  if (!Array.isArray(steps) || steps.length === 0) {
    return "missing or invalid 'steps' (must be non-empty array)";
  }
  if (
    extra !== undefined &&
    (typeof extra !== 'number' || !Number.isInteger(extra) || extra < 0)
  ) {
    return "invalid 'allowExtraCalls' (must be a non-negative integer)";
  }
  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    if (!step || typeof step !== 'object') {
      return `step ${i}: not an object`;
    }
    if (step.kind === 'text') {
      if (typeof step.content !== 'string') {
        return `step ${i}: text step requires string 'content'`;
      }
    } else if (step.kind === 'tool_call') {
      if (typeof step.name !== 'string' || step.name.length === 0) {
        return `step ${i}: tool_call step requires non-empty string 'name'`;
      }
      if (
        !step.args ||
        typeof step.args !== 'object' ||
        Array.isArray(step.args)
      ) {
        return `step ${i}: tool_call step requires object 'args'`;
      }
    } else {
      return `step ${i}: unknown kind "${step.kind}" (expected "text" or "tool_call")`;
    }
  }
  return null;
}

function extractLatestScriptKey(messages) {
  const text = messages
    .map((message) => extractText(message?.content))
    .filter(Boolean)
    .join('\n');
  let latest = null;
  for (const match of text.matchAll(TLON_TEST_KEY_RE)) {
    latest = match[1];
  }
  return latest;
}

function extractTagFromLastUserTurn(messages) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role !== 'user') {
      continue;
    }
    const text = extractText(messages[i]?.content);
    let latest = null;
    for (const match of text.matchAll(TLON_TEST_KEY_RE)) {
      latest = match[1];
    }
    return latest;
  }
  return null;
}

function benignFiller() {
  return textResponse('ok');
}

function respondScripted(res, body, scripted) {
  const payload = completionPayload({ model: body.model, scripted });
  if (body.stream === true) {
    sendSseCompletion(res, payload);
  } else {
    sendJson(res, 200, payload);
  }
}

function extractText(content) {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }
        if (part && typeof part === 'object') {
          if (typeof part.text === 'string') {
            return part.text;
          }
          if (typeof part.content === 'string') {
            return part.content;
          }
        }
        return '';
      })
      .join('\n');
  }
  if (
    content &&
    typeof content === 'object' &&
    typeof content.text === 'string'
  ) {
    return content.text;
  }
  return '';
}

function summarizeRequestMessages(messages) {
  return messages.map((message) => {
    const summary = {
      role: typeof message?.role === 'string' ? message.role : '<unknown>',
    };
    const contentSummary = summarizeContent(message?.content);
    if (contentSummary) {
      summary.content = contentSummary;
    }
    const toolCalls = summarizeToolCalls(message?.tool_calls);
    if (toolCalls.length > 0) {
      summary.tool_calls = toolCalls;
    }
    if (typeof message?.tool_call_id === 'string') {
      summary.tool_call_id = message.tool_call_id;
    }
    if (typeof message?.name === 'string') {
      summary.name = message.name;
    }
    return summary;
  });
}

function summarizeContent(content) {
  if (content == null) {
    return { kind: 'empty' };
  }
  if (typeof content === 'string') {
    return {
      kind: 'text',
      text: sanitizePreview(content),
    };
  }
  if (Array.isArray(content)) {
    return {
      kind: 'parts',
      partCount: content.length,
      text: sanitizePreview(extractText(content)),
    };
  }
  if (typeof content === 'object') {
    return {
      kind: 'object',
      text: sanitizePreview(extractText(content)),
    };
  }
  return { kind: typeof content };
}

function summarizeToolCalls(toolCalls) {
  if (!Array.isArray(toolCalls)) {
    return [];
  }
  return toolCalls
    .filter((toolCall) => toolCall && typeof toolCall === 'object')
    .map((toolCall) => ({
      id: typeof toolCall.id === 'string' ? toolCall.id : undefined,
      type: typeof toolCall.type === 'string' ? toolCall.type : undefined,
      function: {
        name:
          typeof toolCall.function?.name === 'string'
            ? toolCall.function.name
            : undefined,
        arguments:
          typeof toolCall.function?.arguments === 'string'
            ? sanitizePreview(toolCall.function.arguments)
            : undefined,
      },
    }));
}

function sanitizePreview(value) {
  const normalized = String(value).replace(/\s+/g, ' ').trim();
  const redacted = normalized.replace(
    /("(?:api[_-]?key|token|secret|password|credential|code)"\s*:\s*")[^"]+(")/gi,
    '$1<redacted>$2'
  );
  return redacted.length > MAX_SUMMARY_TEXT_LENGTH
    ? `${redacted.slice(0, MAX_SUMMARY_TEXT_LENGTH)}...`
    : redacted;
}

function textResponse(content) {
  return {
    message: { role: 'assistant', content },
    finish_reason: 'stop',
  };
}

function toolCallResponse({ name, args }) {
  return {
    message: {
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: `call_${crypto.randomUUID().replace(/-/g, '')}`,
          type: 'function',
          function: {
            name,
            arguments: JSON.stringify(args),
          },
        },
      ],
    },
    finish_reason: 'tool_calls',
  };
}

function completionPayload({ model, scripted }) {
  return {
    id: `chatcmpl-fake-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model ?? 'tlon-test-scripted',
    choices: [
      {
        index: 0,
        message: scripted.message,
        finish_reason: scripted.finish_reason,
      },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  };
}

function sendSseCompletion(res, payload) {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });

  const choice = payload.choices[0];
  const base = {
    id: payload.id,
    object: 'chat.completion.chunk',
    created: payload.created,
    model: payload.model,
  };

  if (choice.message.tool_calls?.length) {
    res.write(
      `data: ${JSON.stringify({
        ...base,
        choices: [
          {
            index: 0,
            delta: { role: 'assistant', tool_calls: choice.message.tool_calls },
            finish_reason: null,
          },
        ],
      })}\n\n`
    );
  } else {
    res.write(
      `data: ${JSON.stringify({
        ...base,
        choices: [
          {
            index: 0,
            delta: { role: 'assistant', content: choice.message.content ?? '' },
            finish_reason: null,
          },
        ],
      })}\n\n`
    );
  }

  res.write(
    `data: ${JSON.stringify({
      ...base,
      choices: [{ index: 0, delta: {}, finish_reason: choice.finish_reason }],
    })}\n\n`
  );
  res.write('data: [DONE]\n\n');
  res.end();
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function formatHostForUrl(host) {
  return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
}
