import crypto from 'node:crypto';
import http from 'node:http';

// Force unbuffered stdout/stderr so logs surface immediately under
// `docker compose logs` instead of waiting on the pipe buffer to flush.
if (process.stdout._handle?.setBlocking) {
  process.stdout._handle.setBlocking(true);
}
if (process.stderr._handle?.setBlocking) {
  process.stderr._handle.setBlocking(true);
}

const port = Number(process.env.PORT ?? 4000);
console.log(
  `[fake-model] starting (pid ${process.pid}, node ${process.version})`
);

const TLON_TEST_KEY_RE = /\[tlon-test:([a-zA-Z0-9_.:-]+)\]/g;

/**
 * Registered scripts: key -> array of steps.
 * Each step is one of:
 *   { kind: "text", content: string }
 *   { kind: "tool_call", name: string, args: object }
 *
 * The server is intentionally dumb: it never parses prompt content to
 * decide what to return. Tests register the exact sequence of model
 * responses via POST /v1/_scripts before sending the prompt.
 */
const scripts = new Map();
const callCounts = new Map();
// Per-script bounded tolerance for "extra" model calls beyond the scripted
// steps. Some flows legitimately make one more model turn than they have
// logical responses (e.g. a DM reply that emits its text and then makes a
// trailing turn). A script opts in with `allowExtraCalls: N`; up to N calls
// past the last step return benign filler (200) instead of a hard 400. This
// is deliberately per-script — global leniency would hide real
// under-specification regressions (see bucket2-redesign.md §4c).
const allowExtraCalls = new Map();
// All /v1/chat/completions calls seen since last reset, in arrival order.
// Tests use this for negative assertions: "no model call for [tlon-test:X]
// arrived after the prompt was sent" — much faster than waiting on a
// silence timeout in the test client.
const receivedCalls = [];

// Monotonic epoch counter, bumped on every reset() (DELETE /v1/_scripts).
// Lets us attribute a late model call to the test generation that was active
// when it arrived, vs the generation that registered its key.
let epoch = 0;

// key -> { epoch } registration history. CRITICALLY this is NOT cleared by
// reset(), so a stale call arriving after a different test reset the server
// can still be attributed to the last owner + registration epoch for its key.
// Bounded FIFO so a long suite can't grow it without limit.
const lastRegistration = new Map();
const MAX_REGISTRATION_HISTORY = 500;

function recordRegistration(key) {
  // Re-registering an existing key updates in place (keeps FIFO position);
  // a brand-new key may need to evict the oldest entry to stay bounded.
  if (
    !lastRegistration.has(key) &&
    lastRegistration.size >= MAX_REGISTRATION_HISTORY
  ) {
    const oldest = lastRegistration.keys().next().value;
    if (oldest !== undefined) {
      lastRegistration.delete(oldest);
    }
  }
  lastRegistration.set(key, { epoch });
}

const server = http.createServer(async (req, res) => {
  try {
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
      scripts.set(key, steps);
      callCounts.set(key, 0);
      allowExtraCalls.set(key, extra);
      recordRegistration(key);
      console.log(
        `[fake-model] registered script "${key}" with ${steps.length} step(s)` +
          (extra > 0 ? ` (+${extra} extra)` : '') +
          ` (epoch ${epoch})`
      );
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'DELETE' && req.url === '/v1/_scripts') {
      scripts.clear();
      callCounts.clear();
      allowExtraCalls.clear();
      receivedCalls.length = 0;
      // Bump the epoch but keep `lastRegistration` so a stale call arriving
      // after this reset can still be attributed to the test that owned its
      // key in a previous epoch.
      epoch += 1;
      console.log(
        `[fake-model] cleared all scripts and received-call log (epoch -> ${epoch})`
      );
      sendJson(res, 200, { ok: true, epoch });
      return;
    }

    if (req.method === 'GET' && req.url.startsWith('/v1/_received')) {
      const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
      const filterKey = url.searchParams.get('key');
      const calls = filterKey
        ? receivedCalls.filter((c) => c.key === filterKey)
        : receivedCalls.slice();
      sendJson(res, 200, { calls, count: calls.length, epoch });
      return;
    }

    if (req.method === 'POST' && req.url === '/v1/chat/completions') {
      const body = await readJson(req);
      const messages = Array.isArray(body.messages) ? body.messages : [];
      const streamFlag = body.stream === true ? ' stream=true' : '';

      // Flatten user-role message text so tests can assert that specific
      // content (e.g. blob transcriptions, filenames) actually reached the
      // model request. We only record user-role messages (not system or
      // assistant) to keep the payload small and the contract clear.
      const userText = messages
        .filter((m) => m?.role === 'user')
        .map((m) => extractText(m?.content))
        .filter(Boolean)
        .join('\n');

      // ── Provenance-aware key selection ────────────────────────────────
      // openclaw re-sends the whole conversation history on every turn, and
      // DMs share one long-lived per-peer session. So a flat "last tag across
      // all messages" lets a PREVIOUS test's tag, still sitting in history,
      // capture an untagged engaging turn (e.g. a thread parent) → stale
      // misroute. Prefer the tag on the LATEST user turn (a genuinely new
      // tagged prompt is authoritative); fall back to the last historical tag
      // only to serve legitimate continuation turns (an untagged tool-result
      // turn whose run was kicked off by an earlier tagged prompt). See
      // bucket2-redesign.md §4b.
      const latestUserKey = extractTagFromLastUserTurn(messages);
      const historicalKey = extractLatestScriptKey(messages);
      let key = null;
      let provenance = 'none';
      if (latestUserKey) {
        key = latestUserKey;
        provenance = 'latest-user';
      } else if (historicalKey && scripts.has(historicalKey)) {
        key = historicalKey;
        provenance = 'history-active';
      } else if (historicalKey) {
        key = historicalKey;
        provenance = 'history-inactive';
      }

      // Attribute this call to the epoch that registered its key. If the
      // registration epoch is older than the current epoch, a reset() ran
      // between registration and arrival — a different test owns the current
      // epoch and this is cross-epoch (stale) bleed. Kept as a DIAGNOSTIC
      // classification, never a hard failure (see bucket2-findings.md).
      const registeredEpoch =
        key && lastRegistration.has(key)
          ? lastRegistration.get(key).epoch
          : null;
      const stale = registeredEpoch !== null && epoch > registeredEpoch;

      receivedCalls.push({
        key,
        at: Date.now(),
        model: body.model ?? null,
        stream: body.stream === true,
        messageCount: messages.length,
        userText,
        epoch,
        registeredEpoch,
        stale,
        provenance,
      });

      // No tag anywhere → loud 400 (preserve negative-path strictness).
      if (!key) {
        console.log(
          `[fake-model] POST /v1/chat/completions model=${body.model}${streamFlag} → 400 (no [tlon-test:KEY] tag)`
        );
        sendJson(res, 400, {
          error: {
            message:
              'no [tlon-test:KEY] tag found in messages; register a script and tag the prompt before sending',
          },
        });
        return;
      }

      const steps = scripts.get(key);

      // Key is not registered in the CURRENT epoch.
      if (!steps) {
        // Stale-history bleed is benign ONLY when the key was inherited from
        // re-sent history (`history-inactive`), not when the newest user turn
        // explicitly carries it. A `latest-user` key with no current script is
        // a real under-specification (the test tagged a turn but forgot to
        // register it) — keep it a loud 400 even if the name matches a prior
        // epoch, so the strict oracle still catches that mistake.
        if (stale && provenance === 'history-inactive') {
          // A prior test's tag rode in on re-sent history for an untagged turn
          // this epoch never scripted. Make it harmless (benign 200) so it
          // can't error a run or wedge the session — but keep it visible as a
          // diagnostic. THIS is the core durability fix.
          console.log(
            `[fake-model] key="${key}"${streamFlag} → 200 STALE-BENIGN (registeredEpoch=${registeredEpoch} arrivedEpoch=${epoch}, provenance=${provenance})`
          );
          respondScripted(res, body, benignFiller());
          return;
        }
        // Genuinely unknown / never-registered key → loud 400.
        console.log(
          `[fake-model] POST /v1/chat/completions key="${key}"${streamFlag} → 400 (no script registered)`
        );
        sendJson(res, 400, {
          error: { message: `no fake-model script registered for "${key}"` },
        });
        return;
      }

      const n = callCounts.get(key) ?? 0;
      if (n >= steps.length) {
        const extra = allowExtraCalls.get(key) ?? 0;
        if (n < steps.length + extra) {
          // Bounded, opted-in extra call — a flow that legitimately makes one
          // more model turn than it has scripted responses. Return benign
          // filler so the run completes cleanly instead of erroring.
          console.log(
            `[fake-model] key="${key}"${streamFlag} → 200 EXTRA call ${n + 1} (of ${steps.length}+${extra})`
          );
          callCounts.set(key, n + 1);
          respondScripted(res, body, benignFiller());
          return;
        }
        // Exhausted current-epoch script → loud 400. This is one of the best
        // signals that a test under-specified its model flow; do not soften it
        // globally (opt in per script via allowExtraCalls instead).
        console.log(
          `[fake-model] POST /v1/chat/completions key="${key}"${streamFlag} → 400 (script exhausted: call ${n + 1} of ${steps.length})`
        );
        sendJson(res, 400, {
          error: {
            message: `fake-model script "${key}" exhausted: call ${n + 1} of ${steps.length} step(s)`,
          },
        });
        return;
      }
      callCounts.set(key, n + 1);

      const step = steps[n];
      const scripted =
        step.kind === 'tool_call'
          ? toolCallResponse({ name: step.name, args: step.args })
          : textResponse(step.content);

      console.log(
        `[fake-model] POST /v1/chat/completions key="${key}"${streamFlag} → 200 step ${n + 1}/${steps.length} (${step.kind}) [${provenance}]`
      );

      respondScripted(res, body, scripted);
      return;
    }

    sendJson(res, 404, {
      error: {
        message: `Unhandled fake model route: ${req.method} ${req.url}`,
      },
    });
  } catch (error) {
    sendJson(res, 500, {
      error: {
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
});

server.on('error', (err) => {
  console.error(`[fake-model] server error:`, err);
});

process.on('uncaughtException', (err) => {
  console.error(`[fake-model] uncaughtException:`, err);
});
process.on('unhandledRejection', (reason) => {
  console.error(`[fake-model] unhandledRejection:`, reason);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[fake-model] listening on :${port}`);
});

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
    const s = steps[i];
    if (!s || typeof s !== 'object') {
      return `step ${i}: not an object`;
    }
    if (s.kind === 'text') {
      if (typeof s.content !== 'string') {
        return `step ${i}: text step requires string 'content'`;
      }
    } else if (s.kind === 'tool_call') {
      if (typeof s.name !== 'string' || s.name.length === 0) {
        return `step ${i}: tool_call step requires non-empty string 'name'`;
      }
      if (!s.args || typeof s.args !== 'object' || Array.isArray(s.args)) {
        return `step ${i}: tool_call step requires object 'args'`;
      }
    } else {
      return `step ${i}: unknown kind "${s.kind}" (expected "text" or "tool_call")`;
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

// The tag on the LATEST user-role turn only (the genuinely new inbound),
// distinct from extractLatestScriptKey which scans the whole re-sent history.
// This is what lets a new tagged prompt take precedence over a stale tag still
// sitting in conversation history (bucket2-redesign.md §4b).
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

// A harmless 200 completion used when we deliberately don't want a model call
// to error a run: stale-history bleed (prior-epoch key) and opted-in bounded
// extra calls. The text is NON-EMPTY on purpose: openclaw treats an empty
// terminal assistant message as an "incomplete terminal response" and fails the
// run via model-fallback, which would defeat the point of serving these calls
// benignly. A minimal "ok" terminates the agent loop cleanly.
function benignFiller() {
  return textResponse('ok');
}

// Send a scripted completion, honoring the request's streaming preference.
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
