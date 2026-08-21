#!/usr/bin/env node
// Patch openclaw's hasPollCreationParams so auxiliary poll fields alone
// (pollDurationHours, pollMulti) don't reclassify a plain send as a poll.
//
// Why: some models pad every optional tool param with a default — "" for
// strings, [] for arrays, and 1 for integers they can't leave empty. The
// host heuristic (openclaw@2026.5.28, src/poll-params.ts) treats any
// nonzero pollDurationHours as poll-creation intent and rejects the send
// with `Poll fields require action "poll"`, even when pollQuestion and
// pollOption are empty — a state in which action "poll" couldn't succeed
// anyway. The agent then retries the identical send until the turn dies,
// so kit setup messages never land.
//
// Fix: only honor the SHARED_POLL_CREATION_PARAM_NAMES sweep when an
// essential field (pollQuestion or pollOption) is non-empty. The
// unknown-poll-param sweep below the loop is untouched.
//
// Run against the host's dist directory (idempotent):
//   node patch-host-poll-heuristic.mjs "$(npm root -g)/openclaw/dist"
//
// Exits 1 if the validator exists but the code shape has changed (likely an
// openclaw version bump) — check whether upstream fixed the heuristic and
// update or delete this patch. Exits 0 if the validator is gone entirely.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MARKER = '__tlonHasEssentialPollParam';
const ERROR_STRING = 'Poll fields require action';
const OLD = '\tfor (const key of SHARED_POLL_CREATION_PARAM_NAMES) {';
const NEW = `\tconst ${MARKER} = ["pollQuestion", "pollOption"].some((key) => {
\t\tconst value = readPollParamRaw(params, key);
\t\tif (typeof value === "string" && value.trim().length > 0) return true;
\t\treturn Array.isArray(value) && value.some((entry) => typeof entry === "string" && entry.trim());
\t});
\tfor (const key of ${MARKER} ? SHARED_POLL_CREATION_PARAM_NAMES : []) {`;

const distDir = process.argv[2];
if (!distDir) {
  console.error('usage: patch-host-poll-heuristic.mjs <openclaw-dist-dir>');
  process.exit(1);
}

const targets = readdirSync(distDir).filter((name) =>
  /^message-action-runner-.*\.js$/.test(name)
);
if (targets.length === 0) {
  console.error(`no message-action-runner chunk in ${distDir}; skipping`);
  process.exit(0);
}

for (const name of targets) {
  const path = join(distDir, name);
  const source = readFileSync(path, 'utf8');
  if (source.includes(MARKER)) {
    console.log(`already patched: ${name}`);
    continue;
  }
  if (!source.includes(ERROR_STRING)) {
    console.log(`poll validator absent in ${name}; nothing to patch`);
    continue;
  }
  const index = source.indexOf(OLD);
  if (index === -1 || source.indexOf(OLD, index + 1) !== -1) {
    console.error(
      `${name}: hasPollCreationParams shape changed — check whether the ` +
        'openclaw version bump fixed the heuristic, then update or delete ' +
        'this patch'
    );
    process.exit(1);
  }
  writeFileSync(path, source.replace(OLD, NEW));
  console.log(`patched: ${name}`);
}
