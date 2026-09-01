#!/usr/bin/env node
/**
 * Harness preflight for the surfaces measurement loop. Two assertions, both
 * session-6a findings converted into controls (see preflight-assertions.mjs for
 * why each one is shaped the way it is):
 *
 *   1. the RUNTIME model accepts image input   (D111)
 *   2. the model's system prompt lists the `surfaces` skill   (D112)
 *
 * Both are answered by ONE probe turn driven down the same path a measurement
 * run uses — a DM from the owner ship through the Tlon channel plugin. Nothing
 * cheaper is faithful: image support depends on the message origin as well as
 * the model, and a system-prompt report only proves what a run was given when
 * it came from a run (`source: "run"`).
 *
 * Exit codes:  0 pass · 1 an assertion failed · 2 the preflight could not run
 *
 * Usage:
 *   node dev/surfaces-preflight.mjs [--json] [--reset-session] [--timeout <s>]
 *
 * Prefer `dev/surfaces-run.sh`, which runs this and refuses to send a
 * measurement prompt if it fails. A preflight nobody invokes is the same defect
 * one level up.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  checkModelAcceptsImages,
  checkSystemPromptListsSkills,
} from './preflight-assertions.mjs';
import { renderProbeCard } from './preflight-card.mjs';

const DEV_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(DEV_DIR, '..', '..', '..');
const COMPOSE_PROJECT = 'openclaw-surfaces-6a';
const OWNER_SHIP = '~ten';
const SESSION_KEY = `agent:dev:tlon:direct:${OWNER_SHIP}`;
const REQUIRED_SKILLS = ['surfaces', 'tlon'];
/** Where the container sees dev/surfaces-6a-out (see the compose file's mounts). */
const CONTAINER_OUT = '/workspace/surfaces-6a-out';
const HOST_OUT = join(DEV_DIR, 'surfaces-6a-out');

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const resetSession = args.includes('--reset-session');
// Comfortably past the 300s run cap, so a preflight that hits the cap is
// reported as a failed probe rather than as a preflight that could not run.
const timeoutS = args.includes('--timeout')
  ? Number(args[args.indexOf('--timeout') + 1])
  : 360;

const log = (...m) => {
  if (!asJson) console.log(...m);
};

function die(code, message) {
  if (asJson) {
    console.log(
      JSON.stringify({ ok: false, stage: 'harness', message }, null, 2)
    );
  } else {
    console.error(`PREFLIGHT COULD NOT RUN: ${message}`);
  }
  process.exit(code);
}

function sh(cmd, cmdArgs, opts = {}) {
  return execFileSync(cmd, cmdArgs, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...opts,
  });
}

function resolveContainer() {
  const id = sh('docker', [
    'ps',
    '-q',
    '--filter',
    `label=com.docker.compose.project=${COMPOSE_PROJECT}`,
  ]).trim();
  if (!id) {
    die(
      2,
      `no running container for compose project ${COMPOSE_PROJECT}. Bring the stack up first:\n` +
        `  docker compose -f packages/openclaw/dev/docker-compose.surfaces-6a.yml --env-file packages/openclaw/.env.surfaces-6a up -d --force-recreate`
    );
  }
  const [full, created, startedAt] = sh('docker', [
    'inspect',
    id,
    '--format',
    '{{.Id}}\n{{.Created}}\n{{.State.StartedAt}}',
  ])
    .trim()
    .split('\n');
  return { id, full, created, startedAt };
}

function gatewayCall(container, method, params) {
  const out = sh('docker', [
    'exec',
    container,
    'sh',
    '-lc',
    `export $(cat /proc/1/environ | tr '\\0' '\\n' | grep '^OPENCLAW_GATEWAY_TOKEN=') ; ` +
      `openclaw gateway call ${method} --params ${JSON.stringify(
        JSON.stringify(params)
      )} --json --timeout 30000`,
  ]);
  return JSON.parse(out);
}

function sendOwnerDm(text) {
  sh(
    'pnpm',
    [
      '--filter',
      '@tloncorp/shared',
      'exec',
      'vite-node',
      '--config',
      'seed/vite.config.ts',
      'seed/probe-dm.ts',
      '--',
      text,
    ],
    { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] }
  );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readSession(container) {
  const usage = gatewayCall(container, 'sessions.usage', {
    includeContextWeight: true,
    limit: 200,
    range: 'all',
  });
  return usage.sessions?.find((s) => s.key === SESSION_KEY) ?? null;
}

/**
 * Find the session MESSAGE log holding the probe turn, by marker.
 *
 * Not by session id, and not the `.trajectory.jsonl` next to it. Two reasons,
 * both learned the hard way:
 *   - `<id>.trajectory.jsonl` is a trace stream (session.started / model.completed),
 *     not messages, and its `context.compiled.systemPrompt` is truncated at
 *     32768 chars, so nothing in it answers either assertion;
 *   - the message log is renamed to `<id>.jsonl.reset.<ts>` the moment anything
 *     resets the session, and this container's owner DM session is shared with
 *     whatever else is driving it. Addressing the file by marker survives both
 *     the rename and a concurrent driver rotating the session mid-probe.
 */
function findTurnFile(container, marker) {
  try {
    const hits = sh('docker', [
      'exec',
      container,
      'sh',
      '-lc',
      `grep -l ${JSON.stringify(marker)} /root/.openclaw/agents/dev/sessions/*.jsonl* 2>/dev/null | head -5`,
    ])
      .split('\n')
      .filter((f) => f.trim() && !f.includes('.trajectory.'));
    if (hits.length === 0) return null;
    return sh('docker', [
      'exec',
      container,
      'cat',
      hits[hits.length - 1].trim(),
    ]);
  } catch {
    return null;
  }
}

/**
 * Everything the turn produced from the probe prompt onwards, split into the
 * assistant's own words and the full turn (tool results included — one of the
 * placeholder mechanisms writes into the tool result rather than the reply).
 */
function extractTurn(trajectory, marker) {
  const lines = trajectory
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    });
  let start = -1;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const msg = lines[i]?.message;
    if (msg?.role === 'user' && JSON.stringify(msg.content).includes(marker)) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;
  const turn = lines.slice(start);
  const textOf = (content) => {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';
    return content
      .map((b) =>
        typeof b === 'string' ? b : b?.type === 'text' ? (b.text ?? '') : ''
      )
      .join('\n');
  };
  const replyText = turn
    .filter((l) => l?.message?.role === 'assistant')
    .map((l) => textOf(l.message.content))
    .join('\n');
  return { turnText: JSON.stringify(turn), replyText };
}

/**
 * The container's CLI actually honours the write fence.
 *
 * `TLON_SURFACE_SCOPE_FILE` is set in docker-compose.surfaces-6a.yml, and an
 * environment change only reaches a container on RECREATE. But recreating is
 * not enough, and the first version of this assertion learned that the
 * expensive way: it read the variable out of the running process, found it set,
 * and passed — while the CLI the bot actually invokes was a `bun --compile`
 * binary built BEFORE the fence existed and ignoring the variable completely.
 * A guard that observes a mechanism's configuration rather than its behaviour
 * is the vacuity this project keeps cataloguing, and it was reproduced here
 * inside an hour of writing the fence.
 *
 * So this EXERCISES it. Three probes, no ship credentials and no writes:
 *
 *   a malformed scope file   → refuses, naming the parse error
 *   a scope file that is not there → refuses, fail-closed
 *   no scope named at all    → falls through to the ordinary failure
 *
 * The third is the control. Without it the first two would pass equally against
 * a CLI that failed on everything; with it, a binary that lacks the fence
 * produces the same ordinary failure three times and is caught.
 */
function assertFenced(container) {
  const notes = [];
  const failures = [];

  const env = (name) => {
    try {
      return sh('docker', [
        'exec',
        container.id,
        'sh',
        '-c',
        `printf %s "$${name}"`,
      ]).trim();
    } catch {
      return '';
    }
  };

  const scopePath = env('TLON_SURFACE_SCOPE_FILE');
  if (scopePath === '') {
    failures.push(
      'TLON_SURFACE_SCOPE_FILE is not set in the running container. The compose file ' +
        'sets it; an env change reaches a container only on recreate, so bring the stack ' +
        'down and up rather than restarting it.'
    );
    return { ok: false, notes, failures };
  }
  notes.push(`TLON_SURFACE_SCOPE_FILE=${scopePath}`);

  const skillDir = env('TLON_SKILL_DIR');
  if (skillDir === '') {
    failures.push('TLON_SKILL_DIR is not set, so the CLI cannot be located.');
    return { ok: false, notes, failures };
  }
  const cli = `${skillDir}/bin/tlon`;

  const probe = (scopeEnv) => {
    try {
      return sh('docker', [
        'exec',
        container.id,
        'sh',
        '-c',
        `printf %s 'not json at all' > /tmp/fence-probe-bad.json; ` +
          `TLON_URL= TLON_SHIP= TLON_CODE= ${scopeEnv} ${cli} ` +
          `surface show chat/~zod/a-channel-that-does-not-exist --json 2>&1 | tail -1`,
      ]).trim();
    } catch (error) {
      return `PROBE FAILED: ${error.message}`;
    }
  };

  const malformed = probe('TLON_SURFACE_SCOPE_FILE=/tmp/fence-probe-bad.json');
  const missing = probe('TLON_SURFACE_SCOPE_FILE=/tmp/fence-probe-absent.json');
  const unfenced = probe('TLON_SURFACE_SCOPE_FILE=');

  const refusedFor = (output, why) =>
    /not JSON|could not be read/i.test(output);
  if (!refusedFor(malformed)) {
    failures.push(
      'the CLI in this container accepted a malformed scope file. The binary the bot ' +
        'invokes predates the write fence — rebuild it ' +
        '(TLON_SKILL_FROM_SOURCE=1 dev/build-local-skill-override.sh) before measuring ' +
        `anything. It said: ${malformed.slice(0, 200)}`
    );
  }
  if (!refusedFor(missing)) {
    failures.push(
      'the CLI treated an absent scope file as unfenced rather than refusing. A fence ' +
        `that fails open is decoration. It said: ${missing.slice(0, 200)}`
    );
  }
  // The control. If this ALSO refuses, the two above prove nothing — the CLI is
  // simply failing on everything and the fence has not been shown to exist.
  if (refusedFor(unfenced)) {
    failures.push(
      'the CLI refused with a scope-file error even when no scope was named, so the two ' +
        'refusals above are not evidence of a fence. Something else is failing: ' +
        `${unfenced.slice(0, 200)}`
    );
  } else {
    notes.push(
      `unfenced control fell through to the ordinary failure: ${unfenced.slice(0, 120)}`
    );
  }

  let scope = '';
  try {
    scope = sh('docker', ['exec', container.id, 'cat', scopePath]);
    notes.push(`scope in force: ${JSON.stringify(JSON.parse(scope))}`);
  } catch {
    failures.push(
      `the container cannot read or parse ${scopePath}, so every surface write would ` +
        'fail. dev/surfaces-run.sh writes one; by hand it is {"groups":["~zod/your-group"]}.'
    );
  }

  return { ok: failures.length === 0, notes, failures };
}

async function main() {
  const startedAt = Date.now();
  const container = resolveContainer();
  log(
    `container: ${container.id} (created ${container.created}, started ${container.startedAt})`
  );

  const fenced = assertFenced(container);

  const token = Array.from({ length: 16 }, () =>
    String(Math.floor(Math.random() * 10))
  ).join('');
  const squares = 3 + Math.floor(Math.random() * 5);
  const marker = `preflight-${startedAt.toString(36)}`;
  const cardDir = join(HOST_OUT, 'preflight');
  mkdirSync(cardDir, { recursive: true });
  const cardName = `${marker}.png`;
  const { png, width, height } = renderProbeCard({ token, squares });
  writeFileSync(join(cardDir, cardName), png);
  const containerCard = `${CONTAINER_OUT}/preflight/${cardName}`;
  log(
    `probe card: ${containerCard} (${width}x${height}, ${png.length} bytes, ${squares} squares)`
  );

  // Deliberately NOT resetting the session here. `/new` is destructive to
  // whatever else is driving this container's owner DM session, and this
  // container's session IS shared in practice. The probe leaves one short turn
  // in the session; `dev/surfaces-run.sh` resets between the preflight and its
  // own measurement prompt, where the reset is the caller's to make.
  if (resetSession) {
    sendOwnerDm('/new');
    await sleep(6000);
  }

  sendOwnerDm(
    `${marker}: read the image file at ${containerCard} with your file-reading tool ` +
      `and reply with two things and nothing else — the 16-digit number printed on it, ` +
      `and how many blue squares are below the number. Do not use any other tool.`
  );

  let session = null;
  const deadline = Date.now() + timeoutS * 1000;
  while (Date.now() < deadline) {
    await sleep(5000);
    const turnLog = findTurnFile(container.id, marker);
    const turn = turnLog ? extractTurn(turnLog, marker) : null;
    if (turn && turn.replyText.trim().length > 0) {
      // Read the report only once the turn is on disk, so the report that
      // answers assertion 2 is the closest one to the run that answered
      // assertion 1.
      session = readSession(container.id);
      if (session) session.__turn = turn;
      break;
    }
  }
  if (!session) {
    die(2, `no completed probe turn within ${timeoutS}s (marker ${marker})`);
  }

  const vision = checkModelAcceptsImages({
    turnText: session.__turn.turnText,
    replyText: session.__turn.replyText,
    token,
  });
  const skills = checkSystemPromptListsSkills({
    session,
    requiredSkills: REQUIRED_SKILLS,
    notBefore: startedAt,
  });

  const result = {
    ok: vision.ok && skills.ok && fenced.ok,
    container: {
      id: container.id,
      created: container.created,
      startedAt: container.startedAt,
    },
    marker,
    token,
    squares,
    model: `${session.modelProvider}/${session.model}`,
    sessionId: session.sessionId,
    reply: session.__turn.replyText.trim(),
    checks: {
      'model-accepts-images': vision,
      'system-prompt-lists-skills': skills,
      'container-is-write-fenced': fenced,
    },
  };

  // Transcripts are not storage: the evidence for this preflight lands next to
  // the card it used, in the same call that produced it.
  writeFileSync(
    join(cardDir, `${marker}.json`),
    `${JSON.stringify(result, null, 2)}\n`
  );

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    log('');
    log(`model: ${result.model}`);
    log(`reply: ${JSON.stringify(result.reply)}`);
    for (const [name, check] of Object.entries(result.checks)) {
      log(`\n[${check.ok ? 'PASS' : 'FAIL'}] ${name}`);
      for (const n of check.notes) log(`    note: ${n}`);
      for (const f of check.failures) log(`    FAIL: ${f}`);
    }
    log('');
    log(result.ok ? 'PREFLIGHT PASSED' : 'PREFLIGHT FAILED');
  }

  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => die(2, err?.stack ?? String(err)));
