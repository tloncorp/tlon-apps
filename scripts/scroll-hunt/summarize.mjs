#!/usr/bin/env node
// Summarises a diagnostics timeline one conversation list at a time: how long
// it took to appear, what moved after it was shown, what was flagged, and how
// many display frames the UI thread missed while the list was opening and
// while it was being scrolled.
//
//   node scripts/scroll-hunt/summarize.mjs timeline.json [--all]
//
// `--all` prints every entry after the list was shown instead of only the
// ones that can move content.
import { readFileSync } from 'node:fs';

const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error('usage: summarize.mjs <timeline.json> [--all]');
  process.exit(1);
}
const showAll = flags.includes('--all');
const events = JSON.parse(readFileSync(file, 'utf8'));
const shorten = (message) =>
  message.replace(/\d{3}(\.\d{3}){8,}/g, (id) => `~${id.slice(-11)}`);

// A list is `channel#n`; the components around it log as plain `channel`.
const lists = new Map();
for (const event of events) {
  if (event.type === 'lifecycle' && event.message.startsWith('list mounted')) {
    lists.set(event.list, { mount: event, events: [] });
  }
}
for (const event of events) {
  for (const [label, list] of lists) {
    const sameConversation = event.list.split('#')[0] === label.split('#')[0];
    if (
      event.list === label ||
      (sameConversation && !event.list.includes('#'))
    ) {
      list.events.push(event);
    }
  }
}

// Late display frames are reported for the app as a whole, each with the gap
// before it and what that gap should have been.
const lateFrames = events.filter(
  (event) => event.type === 'frames' && event.data?.gap
);

/**
 * Frame pacing over the stretches of time in `windows`: frames missed, and
 * time lost to late frames per second, which is the figure Apple grades
 * scrolling and transitions by (under 5 smooth, over 10 plainly stuttering).
 */
function pacing(windows) {
  let ms = 0;
  let missed = 0;
  let lateMs = 0;
  let worst = 0;
  for (const [from, to] of windows) {
    ms += Math.max(0, to - from);
    for (const frame of lateFrames) {
      // A late frame belongs to the stretch its gap fell in.
      if (frame.t < from || frame.t - frame.data.gap > to) {
        continue;
      }
      const { gap, interval } = frame.data;
      missed += Math.max(1, Math.round(gap / interval) - 1);
      lateMs += gap - interval;
      worst = Math.max(worst, gap);
    }
  }
  if (ms === 0) {
    return null;
  }
  return `${missed} frames missed in ${(ms / 1000).toFixed(1)}s, ${(lateMs / (ms / 1000)).toFixed(1)}ms late per second, worst gap ${Math.round(worst)}ms`;
}

/** The stretches between each `starts` entry and the `ends` entry after it. */
function stretches(entries, starts, ends, until) {
  const windows = [];
  let from = null;
  for (const event of entries) {
    if (from === null && starts(event)) {
      from = event.t;
    } else if (from !== null && ends(event)) {
      windows.push([from, event.t]);
      from = null;
    }
  }
  if (from !== null && Number.isFinite(until)) {
    windows.push([from, until]);
  }
  return windows;
}

const MOVES = new Set([
  'adjust',
  'adjust-missed',
  'auto-scroll',
  'blank',
  'data',
  'inset',
  'landing',
  'position',
  'reflow',
  'resize',
  'row',
  'shift',
  'stall',
  'visibility',
]);

for (const [label, list] of lists) {
  const { mount } = list;
  const unmount = list.events.find(
    (event) =>
      event.list === label &&
      event.type === 'lifecycle' &&
      event.message.startsWith('list unmounted')
  );
  const end = unmount ? unmount.t : Infinity;
  const own = list.events.filter(
    (event) => event.t >= mount.t - 50 && event.t <= end
  );
  const shown = own.find(
    (event) => event.type === 'visibility' && event.message.includes('shown')
  );
  const lastShown = [...own]
    .reverse()
    .find(
      (event) => event.type === 'visibility' && event.message.includes('shown')
    );
  const flagged = own.filter((event) => event.flag);
  console.log(`\n=== ${label} — ${shorten(mount.message)}`);
  console.log(
    `    visible for good ${lastShown ? Math.round(lastShown.t - mount.t) : '—'}ms after mounting; on screen ${unmount ? Math.round(end - mount.t) : '?'}ms; ${flagged.length} flagged`
  );
  const settledAt = lastShown ? lastShown.t : mount.t;
  if (lateFrames.length > 0) {
    const conversation = label.split('#')[0];
    const sliding = stretches(
      events.filter(
        (event) => event.type === 'nav' && event.list === conversation
      ),
      (event) => event.message.endsWith('began'),
      (event) => event.message.endsWith('ended'),
      end
    ).filter(([from]) => from >= mount.t - 1000 && from <= end);
    const scrolling = stretches(
      own.filter((event) => event.type === 'gesture'),
      (event) => /^(drag|momentum) began/.test(event.message),
      (event) => event.message === 'momentum ended',
      end
    );
    const report = [
      ['sliding in', pacing(sliding)],
      ['opening', shown ? pacing([[mount.t, shown.t]]) : null],
      ['scrolling', pacing(scrolling)],
    ].filter(([, text]) => text);
    for (const [name, text] of report) {
      console.log(`    frames while ${name}: ${text}`);
    }
  }
  for (const event of own) {
    const beforeShown = event.t < settledAt;
    const worth =
      event.flag ||
      event.type === 'visibility' ||
      event.type === 'lifecycle' ||
      (beforeShown
        ? event.type === 'data' || event.type === 'state'
        : showAll || MOVES.has(event.type) || event.type === 'state');
    if (!worth) {
      continue;
    }
    console.log(
      `    ${String(Math.round(event.t - settledAt)).padStart(6)}ms ${event.flag ? `!${event.flag.toUpperCase()} ` : ''}${event.type}: ${shorten(event.message).slice(0, 230)}`
    );
  }
}
