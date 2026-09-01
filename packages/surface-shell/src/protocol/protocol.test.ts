import { expect, test } from 'vitest';

import { isHostToShellMessage } from './guards';
import {
  HostToShellMessageSchema,
  ShellInvokeMessageSchema,
  ShellToHostMessageSchema,
} from './schemas';
import { ERROR_MESSAGE_MAX_LENGTH } from './types';

const validSpec = {
  surfaceId: 'srf-1',
  specRevision: 3,
  title: 'Poll',
  actions: { vote: { ops: [] } },
  futureField: true,
};

const validInit = {
  type: 'init',
  protocolVersion: 1,
  spec: validSpec,
  state: { votes: {} },
  theme: 'light',
  canInvoke: true,
};

const hostToShellValid = [
  validInit,
  // `now` is optional and additive: a host that predates it sends `validInit`
  // above and the shell renders with `context.now` null.
  { ...validInit, now: 1735689600000 },
  { type: 'state', state: { votes: { '~zod': 'yes' } } },
  { type: 'theme', theme: 'dark' },
  { type: 'permission', canInvoke: false },
  { type: 'now', now: 1735689600000 },
];

const hostToShellInvalid = [
  null,
  42,
  'init',
  {},
  { type: 'unknown' },
  { type: 'init' },
  { ...validInit, theme: 'dracula' },
  { ...validInit, canInvoke: 'yes' },
  { ...validInit, state: [1, 2] },
  { ...validInit, spec: { surfaceId: '', specRevision: 1, actions: {} } },
  { ...validInit, spec: { surfaceId: 's', specRevision: -1, actions: {} } },
  { ...validInit, spec: { surfaceId: 's', specRevision: 1, actions: null } },
  { type: 'state', state: 'nope' },
  { type: 'theme', theme: 'blue' },
  { type: 'permission' },
  // A non-finite clock formats as "Invalid Date" on every viewer's screen
  // rather than failing anywhere a developer would see it, so both validators
  // refuse it outright.
  { ...validInit, now: Number.NaN },
  { ...validInit, now: Number.POSITIVE_INFINITY },
  { ...validInit, now: '1735689600000' },
  { type: 'now' },
  { type: 'now', now: Number.NaN },
  { type: 'now', now: 'later' },
];

test('host→shell: zod schema and in-sandbox guard agree', () => {
  for (const message of hostToShellValid) {
    expect(HostToShellMessageSchema.safeParse(message).success).toBe(true);
    expect(isHostToShellMessage(message)).toBe(true);
  }
  for (const message of hostToShellInvalid) {
    expect(HostToShellMessageSchema.safeParse(message).success).toBe(false);
    expect(isHostToShellMessage(message)).toBe(false);
  }
});

test('shell→host: valid messages parse', () => {
  const valid = [
    { type: 'ready', shellVersion: 1, protocolVersion: 1 },
    { type: 'invoke', actionId: 'vote', specRevision: 3 },
    { type: 'error', phase: 'render', message: 'boom' },
  ];
  for (const message of valid) {
    expect(ShellToHostMessageSchema.safeParse(message).success).toBe(true);
  }
});

test('shell→host: malformed and widened messages are rejected', () => {
  const invalid = [
    { type: 'invoke' },
    { type: 'invoke', actionId: 'Not Valid!', specRevision: 1 },
    { type: 'invoke', actionId: 'a'.repeat(65), specRevision: 1 },
    { type: 'invoke', actionId: 'vote', specRevision: 1.5 },
    { type: 'invoke', actionId: 'vote', specRevision: -1 },
    // capability-widening attempts fail loudly rather than being stripped
    { type: 'invoke', actionId: 'vote', specRevision: 1, ops: [{}] },
    { type: 'invoke', actionId: 'vote', specRevision: 1, actor: '~zod' },
    { type: 'ready', shellVersion: 1, protocolVersion: 1, extra: true },
    { type: 'error', phase: 'render' },
    { type: 'error', phase: 'sneaky', message: 'x' },
    {
      type: 'error',
      phase: 'render',
      message: 'x'.repeat(ERROR_MESSAGE_MAX_LENGTH + 1),
    },
    { type: 'sendMessage', text: 'widened' },
    { type: 'navigate', to: 'somewhere' },
  ];
  for (const message of invalid) {
    expect(ShellToHostMessageSchema.safeParse(message).success).toBe(false);
  }
});

test('invoke schema strictness is not order-dependent', () => {
  const smuggled = {
    specRevision: 1,
    ops: [],
    actionId: 'vote',
    type: 'invoke',
  };
  expect(ShellInvokeMessageSchema.safeParse(smuggled).success).toBe(false);
});
