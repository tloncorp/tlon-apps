import crypto from "node:crypto";
import http from "node:http";

// Force unbuffered stdout/stderr so logs surface immediately under
// `docker compose logs` instead of waiting on the pipe buffer to flush.
if (process.stdout._handle?.setBlocking) {
  process.stdout._handle.setBlocking(true);
}
if (process.stderr._handle?.setBlocking) {
  process.stderr._handle.setBlocking(true);
}

const port = Number(process.env.PORT ?? 4000);
console.log(`[fake-model] starting (pid ${process.pid}, node ${process.version})`);

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
// All /v1/chat/completions calls seen since last reset, in arrival order.
// Tests use this for negative assertions: "no model call for [tlon-test:X]
// arrived after the prompt was sent" — much faster than waiting on a
// silence timeout in the test client.
const receivedCalls = [];

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && req.url === "/v1/models") {
      sendJson(res, 200, {
        object: "list",
        data: [{ id: "tlon-test-scripted", object: "model", owned_by: "tlon-tests" }],
      });
      return;
    }

    if (req.method === "POST" && req.url === "/v1/_scripts") {
      const body = await readJson(req);
      const { key, steps } = body ?? {};
      const validation = validateScript(key, steps);
      if (validation) {
        sendJson(res, 400, { error: { message: validation } });
        return;
      }
      scripts.set(key, steps);
      callCounts.set(key, 0);
      console.log(`[fake-model] registered script "${key}" with ${steps.length} step(s)`);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "DELETE" && req.url === "/v1/_scripts") {
      scripts.clear();
      callCounts.clear();
      receivedCalls.length = 0;
      console.log(`[fake-model] cleared all scripts and received-call log`);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && req.url.startsWith("/v1/_received")) {
      const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
      const filterKey = url.searchParams.get("key");
      const calls = filterKey
        ? receivedCalls.filter((c) => c.key === filterKey)
        : receivedCalls.slice();
      sendJson(res, 200, { calls, count: calls.length });
      return;
    }

    if (req.method === "POST" && req.url === "/v1/chat/completions") {
      const body = await readJson(req);
      const messages = Array.isArray(body.messages) ? body.messages : [];
      const key = extractLatestScriptKey(messages);
      const streamFlag = body.stream === true ? " stream=true" : "";

      // Flatten user-role message text so tests can assert that specific
      // content (e.g. blob transcriptions, filenames) actually reached the
      // model request. We only record user-role messages (not system or
      // assistant) to keep the payload small and the contract clear.
      const userText = messages
        .filter((m) => m?.role === "user")
        .map((m) => extractText(m?.content))
        .filter(Boolean)
        .join("\n");

      receivedCalls.push({
        key,
        at: Date.now(),
        model: body.model ?? null,
        stream: body.stream === true,
        messageCount: messages.length,
        userText,
      });

      if (!key) {
        console.log(
          `[fake-model] POST /v1/chat/completions model=${body.model}${streamFlag} → 400 (no [tlon-test:KEY] tag)`,
        );
        sendJson(res, 400, {
          error: {
            message:
              "no [tlon-test:KEY] tag found in messages; register a script and tag the prompt before sending",
          },
        });
        return;
      }

      const steps = scripts.get(key);
      if (!steps) {
        console.log(
          `[fake-model] POST /v1/chat/completions key="${key}"${streamFlag} → 400 (no script registered)`,
        );
        sendJson(res, 400, {
          error: { message: `no fake-model script registered for "${key}"` },
        });
        return;
      }

      const n = callCounts.get(key) ?? 0;
      if (n >= steps.length) {
        console.log(
          `[fake-model] POST /v1/chat/completions key="${key}"${streamFlag} → 400 (script exhausted: call ${n + 1} of ${steps.length})`,
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
        step.kind === "tool_call"
          ? toolCallResponse({ name: step.name, args: step.args })
          : textResponse(step.content);

      console.log(
        `[fake-model] POST /v1/chat/completions key="${key}"${streamFlag} → 200 step ${n + 1}/${steps.length} (${step.kind})`,
      );

      const payload = completionPayload({ model: body.model, scripted });

      if (body.stream === true) {
        sendSseCompletion(res, payload);
      } else {
        sendJson(res, 200, payload);
      }
      return;
    }

    sendJson(res, 404, {
      error: { message: `Unhandled fake model route: ${req.method} ${req.url}` },
    });
  } catch (error) {
    sendJson(res, 500, {
      error: { message: error instanceof Error ? error.message : String(error) },
    });
  }
});

server.on("error", (err) => {
  console.error(`[fake-model] server error:`, err);
});

process.on("uncaughtException", (err) => {
  console.error(`[fake-model] uncaughtException:`, err);
});
process.on("unhandledRejection", (reason) => {
  console.error(`[fake-model] unhandledRejection:`, reason);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`[fake-model] listening on :${port}`);
});

function validateScript(key, steps) {
  if (typeof key !== "string" || key.length === 0) {
    return "missing or invalid 'key' (must be non-empty string)";
  }
  if (!Array.isArray(steps) || steps.length === 0) {
    return "missing or invalid 'steps' (must be non-empty array)";
  }
  for (let i = 0; i < steps.length; i += 1) {
    const s = steps[i];
    if (!s || typeof s !== "object") {
      return `step ${i}: not an object`;
    }
    if (s.kind === "text") {
      if (typeof s.content !== "string") {
        return `step ${i}: text step requires string 'content'`;
      }
    } else if (s.kind === "tool_call") {
      if (typeof s.name !== "string" || s.name.length === 0) {
        return `step ${i}: tool_call step requires non-empty string 'name'`;
      }
      if (!s.args || typeof s.args !== "object" || Array.isArray(s.args)) {
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
    .join("\n");
  let latest = null;
  for (const match of text.matchAll(TLON_TEST_KEY_RE)) {
    latest = match[1];
  }
  return latest;
}

function extractText(content) {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part === "object") {
          if (typeof part.text === "string") {
            return part.text;
          }
          if (typeof part.content === "string") {
            return part.content;
          }
        }
        return "";
      })
      .join("\n");
  }
  if (content && typeof content === "object" && typeof content.text === "string") {
    return content.text;
  }
  return "";
}

function textResponse(content) {
  return {
    message: { role: "assistant", content },
    finish_reason: "stop",
  };
}

function toolCallResponse({ name, args }) {
  return {
    message: {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: `call_${crypto.randomUUID().replace(/-/g, "")}`,
          type: "function",
          function: {
            name,
            arguments: JSON.stringify(args),
          },
        },
      ],
    },
    finish_reason: "tool_calls",
  };
}

function completionPayload({ model, scripted }) {
  return {
    id: `chatcmpl-fake-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: model ?? "tlon-test-scripted",
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
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });

  const choice = payload.choices[0];
  const base = {
    id: payload.id,
    object: "chat.completion.chunk",
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
            delta: { role: "assistant", tool_calls: choice.message.tool_calls },
            finish_reason: null,
          },
        ],
      })}\n\n`,
    );
  } else {
    res.write(
      `data: ${JSON.stringify({
        ...base,
        choices: [
          {
            index: 0,
            delta: { role: "assistant", content: choice.message.content ?? "" },
            finish_reason: null,
          },
        ],
      })}\n\n`,
    );
  }

  res.write(
    `data: ${JSON.stringify({
      ...base,
      choices: [{ index: 0, delta: {}, finish_reason: choice.finish_reason }],
    })}\n\n`,
  );
  res.write("data: [DONE]\n\n");
  res.end();
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}
