#!/usr/bin/env node
// Splits a Hermes CPU profile into named buckets, overall and per time window.
//
//   node scripts/scroll-hunt/cpu-breakdown.mjs profile_cpu.json [--window from:to ...] [--top 12]
//
// A sample goes to the first bucket (in the order below) with a matching
// function anywhere on its stack, so nested work is charged to the outer cause.
import fs from 'node:fs';

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith('--'));
if (!file) {
  console.error(
    'usage: cpu-breakdown.mjs profile_cpu.json [--window from:to ...] [--top n]'
  );
  process.exit(1);
}
const windows = [];
let top = 12;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--window') {
    const [from, to] = args[++i].split(':').map(Number);
    windows.push({ from, to });
  } else if (args[i] === '--top') {
    top = Number(args[++i]);
  }
}

const BUCKETS = [
  ['idle', /^\(idle\)$|^\(program\)$/],
  [
    'react-query devtools: serialise + send',
    /^handleCacheEvent$|^getSerializedQueries$/,
  ],
  ['expo devtools: receive', /^unpack$|^messageListener$|handleMessage$/],
  [
    'scroll diagnostics',
    /^noteScrollDiagnostics$|^flush$|^compare$|^analyzeShift$|ScrollDiag/,
  ],
  [
    'database rows (drizzle)',
    /^mapRelationalRow$|^mapResultRow$|^_loop2$|^executeAsync$|^prepareQuery$/,
  ],
  [
    'react render',
    /^renderRootSync$|^renderRootConcurrent$|^performUnitOfWork$|^beginWork$/,
  ],
  [
    'react commit + effects',
    /^commitRoot|^flushPassiveEffects|^commitLayoutEffects|^flushLayoutEffects|^commitMutationEffects/,
  ],
  ['garbage collection', /^\[GC/],
];

const profile = JSON.parse(fs.readFileSync(file, 'utf8'));
const { nodes, samples, timeDeltas, startTime } = profile.profile ?? profile;
const byId = new Map(nodes.map((node) => [node.id, node]));
const parent = new Map();
for (const node of nodes) {
  for (const child of node.children ?? []) {
    parent.set(child, node.id);
  }
}
const bucketOf = new Map();
function classify(id) {
  if (bucketOf.has(id)) {
    return bucketOf.get(id);
  }
  const stack = [];
  for (let cur = id; cur !== undefined; cur = parent.get(cur)) {
    stack.push(byId.get(cur).callFrame.functionName);
  }
  let found = 'other JS';
  // Outermost frame first, so the cause that started the work wins.
  outer: for (const [name, pattern] of BUCKETS) {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (pattern.test(stack[i])) {
        found = name;
        break outer;
      }
    }
  }
  bucketOf.set(id, found);
  return found;
}

function report(label, from, to) {
  const totals = new Map();
  const leaves = new Map();
  let t = 0;
  let covered = 0;
  for (let i = 0; i < samples.length; i++) {
    const delta = (timeDeltas[i] ?? 0) / 1000;
    t += delta;
    if (t < from || t > to) {
      continue;
    }
    covered += delta;
    const bucket = classify(samples[i]);
    totals.set(bucket, (totals.get(bucket) ?? 0) + delta);
    if (bucket === 'other JS') {
      const frame = byId.get(samples[i]).callFrame;
      const key = `${frame.functionName || '(anonymous)'}:${frame.lineNumber}`;
      leaves.set(key, (leaves.get(key) ?? 0) + delta);
    }
  }
  console.log(`\n${label}: ${Math.round(covered)}ms sampled`);
  for (const [bucket, ms] of [...totals].sort((a, b) => b[1] - a[1])) {
    console.log(
      `  ${String(Math.round(ms)).padStart(6)}ms  ${String(Math.round((ms / covered) * 100)).padStart(3)}%  ${bucket}`
    );
  }
  const otherLeaves = [...leaves].sort((a, b) => b[1] - a[1]).slice(0, top);
  if (otherLeaves.length > 0) {
    console.log(
      `  top "other JS" functions: ${otherLeaves.map(([key, ms]) => `${key} ${Math.round(ms)}ms`).join(', ')}`
    );
  }
}

const total = timeDeltas.reduce((sum, delta) => sum + delta, 0) / 1000;
console.log(
  `profile: ${Math.round(total)}ms, ${samples.length} samples, start ${startTime}`
);
report('whole profile', 0, Infinity);
for (const { from, to } of windows) {
  report(`window ${from}–${to}ms`, from, to);
}
