#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export const scenarios = [
  'dm-post',
  'dm-post-mention',
  'dm-reply',
  'dm-reply-mention',
  'dm-react',
  'dm-react-reply',
  'dm-invite',
  'post',
  'post-mention',
  'reply',
  'reply-mention',
  'react',
  'react-reply',
  'group-ask',
  'group-invite',
  'group-join',
  'group-kick',
  'group-role',
  'flag-post',
  'flag-reply',
  'note-create',
  'note-edit',
  'contact',
  'contact-matched',
  'contacts-matched',
  'node-resume-nudge',
  'message',
  'dismiss',
  'native-notify',
  'native-message',
  'malformed-activity',
  'unknown-activity',
  'missing-event',
  'unrecognized',
];

function required(options, name) {
  const value = options[name];
  if (typeof value !== 'string' || !value.trim() || /[<>]|\$\{/.test(value)) {
    throw new Error(
      `Provide --${name} with the actual identifier/value; placeholders are not accepted.`
    );
  }
  return value;
}

function nonnegativeInteger(value, name) {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
    throw new Error(`--${name} must be a nonnegative integer.`);
  }
  return Number(value);
}

function postKey(options, name) {
  const id = required(options, name);
  if (!/^~[a-z-]+\/(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(id)) {
    throw new Error(
      `--${name} must be the wire post ID (~author/decimal-@da), not a local timestamp.`
    );
  }
  return { id, time: '0' };
}

/** Minimal post-extension payloads for the app's tap parser, not server activity fixtures. */
export function buildPayload(options) {
  const scenario = required(options, 'scenario');
  if (!scenarios.includes(scenario))
    throw new Error(`Unknown scenario: ${scenario}. Use --list.`);
  const kind = scenario
    .replace(/-mention$/, '')
    .replace(/react-reply$/, 'react');
  const thread =
    kind === 'dm-reply' ||
    kind === 'reply' ||
    kind === 'flag-reply' ||
    scenario.endsWith('react-reply');
  const allowedIds = kind.startsWith('dm-')
    ? [
        'channel-id',
        ...(kind === 'dm-invite' ? [] : ['post-id']),
        ...(thread ? ['parent-id'] : []),
      ]
    : ['post', 'reply', 'react', 'flag-post', 'flag-reply'].includes(kind)
      ? ['channel-id', 'group-id', 'post-id', ...(thread ? ['parent-id'] : [])]
      : kind.startsWith('group-')
        ? ['group-id', ...(kind === 'group-kick' ? ['ship'] : [])]
        : kind.startsWith('note-')
          ? ['channel-id', 'note-id']
          : ['contact', 'contact-matched'].includes(kind)
            ? ['contact-id']
            : kind === 'node-resume-nudge'
              ? ['ship']
              : kind === 'dismiss'
                ? ['dismiss-source', 'notify-count']
                : [];
  for (const name of [
    'channel-id',
    'group-id',
    'post-id',
    'parent-id',
    'note-id',
    'ship',
    'contact-id',
    'dismiss-source',
    'notify-count',
  ]) {
    if (options[name] !== undefined && !allowedIds.includes(name)) {
      throw new Error(
        `--${name} does not apply to ${scenario}; choose the matching scenario (see --list).`
      );
    }
  }
  for (const name of ['ship', 'contact-id']) {
    if (
      options[name] !== undefined &&
      !/^~[a-z-]+$/.test(required(options, name))
    ) {
      throw new Error(
        `--${name} must be a ~ship identifier, not a display name.`
      );
    }
  }
  const payload = {
    aps: {
      alert: {
        title: options.title ?? 'Tlon notification test',
        body: options.body ?? `Local test: ${scenario}`,
      },
      sound: 'default',
    },
    action: 'notify',
  };
  if (options.badge !== undefined)
    payload.aps.badge = nonnegativeInteger(options.badge, 'badge');
  if (options.uid) payload.uid = required(options, 'uid');
  if (options['notification-id'])
    payload.id = required(options, 'notification-id');
  if (options['extension-error']) {
    payload.notificationServiceExtensionErrors = [options['extension-error']];
  }

  let event;
  if (kind.startsWith('dm-')) {
    const channel = required(options, 'channel-id');
    let whom;
    if (/^~[a-z-]+$/.test(channel)) whom = { ship: channel };
    else if (/^0v[a-z0-9.]+$/.test(channel)) whom = { club: channel };
    else throw new Error('--channel-id must be a ~ship DM or 0v… group-DM ID.');
    payload.channelId = channel;
    const info = { whom, mention: scenario.endsWith('-mention') };
    if (options['post-id']) info.key = postKey(options, 'post-id');
    if (kind === 'dm-reply' || scenario === 'dm-react-reply')
      info.parent = postKey(options, 'parent-id');
    event = { [kind]: kind === 'dm-invite' ? whom : info };
  } else if (
    ['post', 'reply', 'react', 'flag-post', 'flag-reply'].includes(kind)
  ) {
    const channel = required(options, 'channel-id');
    if (!/^[a-z]+\/~[a-z-]+\/[^/\s]+$/.test(channel)) {
      throw new Error(
        '--channel-id must be a full nest such as chat/~host/channel.'
      );
    }
    payload.channelId = channel;
    const info = { channel, mention: scenario.endsWith('-mention') };
    if (options['group-id']) info.group = required(options, 'group-id');
    if (kind === 'flag-post' || options['post-id'])
      info.key = postKey(options, 'post-id');
    if (['reply', 'flag-reply'].includes(kind) || scenario === 'react-reply') {
      info.parent = postKey(options, 'parent-id');
    }
    event = { [kind]: info };
  } else if (kind.startsWith('group-')) {
    const group = required(options, 'group-id');
    if (!/^~[a-z-]+\/[^/\s]+$/.test(group))
      throw new Error('--group-id must be ~host/workspace.');
    const info = { group };
    if (kind === 'group-kick') info.ship = required(options, 'ship');
    event = { [kind]: info };
    payload.aps['thread-id'] = group;
  } else if (kind === 'note-create' || kind === 'note-edit') {
    const channel = required(options, 'channel-id');
    if (!/^notes\/~[a-z-]+\/[^/\s]+$/.test(channel))
      throw new Error('--channel-id must be notes/~host/notebook.');
    const id = required(options, 'note-id');
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(id))
      throw new Error(
        '--note-id must be a decimal string, optionally dot-grouped.'
      );
    payload.channelId = channel;
    event = { [kind]: { notebook: channel.slice('notes/'.length), id } };
  } else {
    switch (kind) {
      case 'contact':
        event = { contact: { who: required(options, 'contact-id') } };
        break;
      case 'contact-matched':
        payload.type = 'contactMatched';
        payload.contactId = required(options, 'contact-id');
        delete payload.action;
        break;
      case 'contacts-matched':
        payload.type = 'contactsMatched';
        delete payload.action;
        break;
      case 'node-resume-nudge':
        payload.ship = required(options, 'ship');
        payload.aps.alert = {
          title: options.title ?? 'Your node is now online',
          body: options.body ?? 'Tap here to jump back in',
        };
        delete payload.action;
        break;
      case 'message':
      case 'native-message':
        payload.action = 'message';
        payload.message = payload.aps.alert.body;
        if (kind === 'native-message') payload.aps['mutable-content'] = 1;
        break;
      case 'native-notify':
        payload.uid = required(options, 'uid');
        payload.aps['mutable-content'] = 1;
        break;
      case 'dismiss':
        if (
          ['title', 'body', 'badge'].some((name) => options[name] !== undefined)
        ) {
          throw new Error(
            'dismiss is silent; use --notify-count for its badge count, without --title/--body/--badge.'
          );
        }
        payload.action = 'dismiss';
        payload.uid = required(options, 'uid');
        payload.id = required(options, 'notification-id');
        payload.dismissSource = required(options, 'dismiss-source');
        payload.notifyCount = String(
          nonnegativeInteger(required(options, 'notify-count'), 'notify-count')
        );
        payload.aps = { 'content-available': 1 };
        break;
      case 'malformed-activity':
        payload.activityEventJsonString = '{';
        break;
      case 'unknown-activity':
        event = { 'test-unknown-event': {} };
        break;
      case 'missing-event':
        payload.activityEventJsonString = '{}';
        break;
      case 'unrecognized':
        delete payload.action;
        break;
    }
  }
  if (event) payload.activityEventJsonString = JSON.stringify({ event });
  if (payload.channelId) payload.aps['thread-id'] = payload.channelId;
  if (options['thread-id'])
    payload.aps['thread-id'] = required(options, 'thread-id');
  return payload;
}

export function validatePayload(payload) {
  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    !payload.aps ||
    typeof payload.aps !== 'object' ||
    Array.isArray(payload.aps)
  ) {
    throw new Error('The payload must be an object with an aps object.');
  }
  const json = JSON.stringify(payload);
  if (Buffer.byteLength(json, 'utf8') > 4096)
    throw new Error('Payload exceeds simctl push’s 4096-byte limit.');
  return json;
}

function send(payload, options) {
  const simulator = required(options, 'simulator');
  const bundle = required(options, 'bundle-id');
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(simulator)) {
    throw new Error(
      '--simulator must be an explicit UDID, not booted or a device name.'
    );
  }
  if (!/^[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/.test(bundle))
    throw new Error('Invalid --bundle-id.');
  const embeddedBundle = payload['Simulator Target Bundle'];
  if (embeddedBundle && embeddedBundle !== bundle)
    throw new Error('Payload bundle conflicts with --bundle-id.');
  const devices = JSON.parse(
    execFileSync(
      'xcrun',
      ['simctl', 'list', 'devices', 'available', '--json'],
      { encoding: 'utf8' }
    )
  );
  const device = Object.values(devices.devices)
    .flat()
    .find((item) => item.udid.toLowerCase() === simulator.toLowerCase());
  if (!device || device.state !== 'Booted')
    throw new Error('Selected simulator is not available and booted.');
  execFileSync(
    'xcrun',
    ['simctl', 'get_app_container', simulator, bundle, 'app'],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );
  execFileSync('xcrun', ['simctl', 'push', simulator, bundle, '-'], {
    input: validatePayload(payload),
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  console.error(
    `Injected one notification into ${bundle} on ${device.name} (${simulator}). Verify delivery and tap separately.`
  );
}

function main() {
  const booleanOptions = ['help', 'list', 'send', 'dry-run'];
  const stringOptions = [
    'scenario',
    'simulator',
    'bundle-id',
    'channel-id',
    'group-id',
    'parent-id',
    'post-id',
    'note-id',
    'ship',
    'contact-id',
    'title',
    'body',
    'badge',
    'uid',
    'notification-id',
    'thread-id',
    'dismiss-source',
    'notify-count',
    'extension-error',
    'payload-file',
    'out',
  ];
  const { values: options, tokens } = parseArgs({
    tokens: true,
    options: Object.fromEntries([
      ...booleanOptions.map((key) => [key, { type: 'boolean' }]),
      ...stringOptions.map((key) => [key, { type: 'string' }]),
    ]),
  });
  const seen = new Set();
  for (const token of tokens) {
    if (token.kind !== 'option') continue;
    if (seen.has(token.name))
      throw new Error(
        `Duplicate option --${token.name}; supply one explicit value.`
      );
    seen.add(token.name);
  }
  if (options.help) {
    console.log(`Usage: node send-push.mjs --scenario NAME [scenario inputs] [--out FILE]
       node send-push.mjs --payload-file FILE [--out FILE]
       Add --send --simulator UDID --bundle-id BUNDLE to inject ONE push.
       Default / --dry-run: print JSON only; no device access.
       --list: print all scenario names.

Scenario inputs: ${stringOptions
      .filter(
        (key) =>
          ![
            'scenario',
            'simulator',
            'bundle-id',
            'payload-file',
            'out',
          ].includes(key)
      )
      .map((key) => `--${key}`)
      .join(', ')}
See ../references/scenarios.md for required IDs and expected destinations.`);
    return;
  }
  if (options.list) {
    console.log(scenarios.join('\n'));
    return;
  }
  if (options.send && options['dry-run'])
    throw new Error('Choose --send or --dry-run, not both.');
  if (options['payload-file'] && options.scenario)
    throw new Error('Choose --payload-file or --scenario, not both.');
  if (options['payload-file']) {
    const ignored = stringOptions.filter(
      (name) =>
        !['simulator', 'bundle-id', 'payload-file', 'out'].includes(name) &&
        options[name] !== undefined
    );
    if (ignored.length)
      throw new Error(
        `Do not combine --payload-file with payload-building options: ${ignored.map((name) => `--${name}`).join(', ')}.`
      );
  }
  const payload = options['payload-file']
    ? JSON.parse(readFileSync(options['payload-file'], 'utf8'))
    : buildPayload(options);
  if (options['bundle-id']) {
    const embeddedBundle = payload['Simulator Target Bundle'];
    if (embeddedBundle && embeddedBundle !== options['bundle-id'])
      throw new Error('Payload bundle conflicts with --bundle-id.');
    payload['Simulator Target Bundle'] = required(options, 'bundle-id');
  }
  const json = validatePayload(payload);
  if (options.out)
    writeFileSync(options.out, JSON.stringify(payload, null, 2) + '\n');
  if (options.send) send(payload, options);
  else console.log(json);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main();
  } catch (error) {
    console.error(`push-testing: ${error.message}`);
    process.exitCode = 1;
  }
}
