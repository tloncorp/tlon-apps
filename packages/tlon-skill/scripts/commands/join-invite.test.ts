import { parseInviteDeepLink } from '@tloncorp/api/client/deeplinks';
import { describe, expect, it } from 'bun:test';

import {
  BUDGET_EXHAUSTED_MESSAGE,
  type GroupPrivacy,
  type GroupStateRead,
  type InviteBiteResult,
  type InviteGroupState,
  type InviteMetadataFields,
  type InviteMetadataResult,
  JOIN_HELP,
  type JoinInviteDeps,
  isInviteJoin,
  plainJoinGroupId,
  run,
} from './join-invite';

const FLAG = '~zod/test';
const TOKEN = '0v1.abcde';
const LINK = `https://invite.tlon.io/${TOKEN}`;

const GROUP_FIELDS: InviteMetadataFields = {
  inviteType: 'group',
  inviterUserId: '~nec',
  invitedGroupId: FLAG,
};

const PERSONAL_FIELDS: InviteMetadataFields = {
  inviteType: 'user',
  inviterUserId: '~nec',
  invitedGroupId: '~zod/personal-invite-link',
};

const NOT_ARRIVED =
  'The invite from ~nec did not arrive in time (their ship may be offline).';
const PENDING_LINE =
  'The invite from ~nec to ~zod/test has not arrived, and its delivery is unconfirmed (their ship may be offline, or invites may be disabled for the group). ' +
  'Run this same command again later to accept the invite once it arrives.\n';

function state(overrides: Partial<InviteGroupState> = {}): GroupStateRead {
  return {
    ok: true,
    state: {
      member: false,
      haveInvite: false,
      haveRequestedInvite: false,
      privacy: 'private',
      ...overrides,
    },
  };
}

function without(
  fields: InviteMetadataFields,
  ...keys: Array<keyof InviteMetadataFields>
): InviteMetadataFields {
  return Object.fromEntries(
    Object.entries(fields).filter(
      ([key]) => !keys.includes(key as keyof InviteMetadataFields)
    )
  );
}

const never = <T>() => new Promise<T>(() => {});

type Clock = { now: number };

interface Options {
  resolvedShipError?: Error;
  authenticate?: (clock: Clock) => Promise<void>;
  fields?: InviteMetadataFields;
  metadata?: (clock: Clock) => Promise<InviteMetadataResult>;
  bite?: (clock: Clock) => Promise<InviteBiteResult>;
  // One entry per getGroupState read (the initial one, then each poll); the
  // last one repeats.
  states?: Array<GroupStateRead | 'hang'>;
  preview?: (clock: Clock) => Promise<GroupPrivacy | null>;
  joinGroup?: () => Promise<void>;
  requestInvite?: () => Promise<void>;
  addContact?: () => Promise<void>;
  joinExistingFlag?: () => Promise<void>;
}

function makeDeps(options: Options = {}) {
  const clock: Clock = { now: 0 };
  const stdout: string[] = [];
  const stderr: string[] = [];
  const sequence: string[] = [];
  const calls = {
    getResolvedShip: 0,
    authenticate: 0,
    fetchInviteMetadata: [] as string[],
    biteInvite: [] as Array<[string, string]>,
    getGroupState: [] as string[],
    getPreviewPrivacy: [] as Array<[string, number]>,
    joinGroup: [] as Array<{ flag: string; at: number }>,
    requestInvite: [] as Array<{ flag: string; at: number }>,
    addContact: [] as string[],
    joinExistingFlag: [] as string[],
    sleep: [] as number[],
  };
  const states = options.states ?? [state()];
  let reads = 0;
  const nextState = async () => {
    const next = states[Math.min(reads, states.length - 1)];
    reads += 1;
    if (next === 'hang') return never<GroupStateRead>();
    return next;
  };

  const deps: JoinInviteDeps = {
    stdout: (text) => stdout.push(text),
    stderr: (text) => stderr.push(text),
    getResolvedShip: () => {
      calls.getResolvedShip += 1;
      sequence.push('getResolvedShip');
      if (options.resolvedShipError) throw options.resolvedShipError;
      return 'ten';
    },
    authenticate: async () => {
      calls.authenticate += 1;
      sequence.push('authenticate');
      await options.authenticate?.(clock);
    },
    parseInviteLink: (input) => parseInviteDeepLink(input),
    joinExistingFlag: async (flag) => {
      calls.joinExistingFlag.push(flag);
      sequence.push('joinExistingFlag');
      await options.joinExistingFlag?.();
    },
    fetchInviteMetadata: async (token) => {
      calls.fetchInviteMetadata.push(token);
      sequence.push('fetchInviteMetadata');
      if (options.metadata) return options.metadata(clock);
      return { kind: 'found', fields: options.fields ?? GROUP_FIELDS };
    },
    biteInvite: async (token, ship) => {
      calls.biteInvite.push([token, ship]);
      sequence.push('biteInvite');
      if (options.bite) return options.bite(clock);
      return { kind: 'sent' };
    },
    getGroupState: async (flag) => {
      calls.getGroupState.push(flag);
      sequence.push('getGroupState');
      return nextState();
    },
    getPreviewPrivacy: async (flag, timeoutMs) => {
      calls.getPreviewPrivacy.push([flag, timeoutMs]);
      sequence.push('getPreviewPrivacy');
      if (options.preview) return options.preview(clock);
      return null;
    },
    joinGroup: async (flag) => {
      calls.joinGroup.push({ flag, at: clock.now });
      sequence.push('joinGroup');
      await options.joinGroup?.();
    },
    requestInvite: async (flag) => {
      calls.requestInvite.push({ flag, at: clock.now });
      sequence.push('requestInvite');
      await options.requestInvite?.();
    },
    addContact: async (ship) => {
      calls.addContact.push(ship);
      sequence.push('addContact');
      await options.addContact?.();
    },
    now: () => clock.now,
    sleep: async (ms) => {
      calls.sleep.push(ms);
      sequence.push(`sleep(${ms})`);
      clock.now += ms;
    },
    // Fires on a macrotask, so any dep that settles through microtasks wins
    // the race; only a dep that never settles loses, and then the fake clock
    // jumps to the cap's expiry.
    startTimer: (ms) => {
      const startedAt = clock.now;
      let handle: ReturnType<typeof setTimeout> | undefined;
      const expired = new Promise<void>((resolve) => {
        handle = setTimeout(() => {
          clock.now = Math.max(clock.now, startedAt + ms);
          resolve();
        }, 0);
      });
      return { expired, cancel: () => clearTimeout(handle) };
    },
  };

  return { deps, clock, stdout, stderr, sequence, calls };
}

async function runWith(args: string[], options: Options = {}) {
  const harness = makeDeps(options);
  const code = await run(args, harness.deps);
  return {
    ...harness,
    code,
    out: harness.stdout.join(''),
    err: harness.stderr.join(''),
  };
}

function expectNoNetwork(calls: ReturnType<typeof makeDeps>['calls']) {
  expect(calls.fetchInviteMetadata).toEqual([]);
  expect(calls.biteInvite).toEqual([]);
}

describe('join --invite parsing', () => {
  it('extracts the token from every accepted link shape', async () => {
    const inputs = [
      LINK,
      `${LINK}/`,
      `invite.tlon.io/${TOKEN}`,
      `https://join.tlon.io/${TOKEN}`,
      `https://serverless-infra.vercel.app/${TOKEN}`,
      `https://sa96e.app.link/${TOKEN}`,
      `https://sa96e-alternate.app.link/${TOKEN}`,
      `https://sa96e.test-app.link/${TOKEN}`,
      `https://sa96e-alternate.test-app.link/${TOKEN}`,
      `https://tlon.network/lure/${TOKEN}`,
      `${LINK}?utm_source=x`,
      `${LINK}#fragment`,
      `https://evil@invite.tlon.io/${TOKEN}`,
      `  ${LINK}  `,
      TOKEN,
      `https://tlon.network/apps/groups/?inviteToken=${TOKEN}`,
      `https://invite.tlon.io/?inviteToken=${TOKEN}&utm_source=x`,
      `https://join.tlon.io/?token=${TOKEN}`,
      `utm_source=x&token=${TOKEN}`,
      `token=${encodeURIComponent(TOKEN)}`,
      // A hostile authority contributes nothing but the token.
      `https://evil.example/?inviteToken=${TOKEN}`,
      `https://invite.tlon.io@evil.example/apps/groups/?inviteToken=${TOKEN}`,
    ];
    for (const input of inputs) {
      const result = await runWith(['--invite', input], {
        states: [state({ privacy: 'public' })],
      });
      expect({ input, code: result.code }).toEqual({ input, code: 0 });
      expect(result.calls.fetchInviteMetadata).toEqual([TOKEN]);
    }
  });

  it('accepts --invite=<value>', async () => {
    const result = await runWith([`--invite=${LINK}`], {
      states: [state({ privacy: 'public' })],
    });
    expect(result.code).toBe(0);
    expect(result.calls.fetchInviteMetadata).toEqual([TOKEN]);
  });

  it('refuses a bare group id as a usage error before resolving credentials', async () => {
    for (const args of [
      ['--invite', FLAG],
      [`--invite=${FLAG}`, '--self'],
    ]) {
      const result = await runWith(args);
      expect(result.code).toBe(1);
      expect(result.err).toBe(
        `Error: --invite takes an invite link or token, not a group id; use \`tlon groups join <group-id>\` for a plain join\n\n${JOIN_HELP}\n`
      );
      expect(result.calls.getResolvedShip).toBe(0);
      expect(result.calls.joinExistingFlag).toEqual([]);
      expectNoNetwork(result.calls);
    }
  });

  it('joins a legacy flag link once the provider knows it', async () => {
    for (const input of [
      `https://invite.tlon.io/${FLAG}`,
      `tlon.network/lure/${FLAG}`,
      `https://tlon.network/apps/groups/?inviteToken=${encodeURIComponent(FLAG)}`,
    ]) {
      const result = await runWith(['--invite', input], { fields: {} });
      expect(result.code).toBe(0);
      expect(result.sequence).toEqual([
        'getResolvedShip',
        'authenticate',
        'fetchInviteMetadata',
        'joinExistingFlag',
      ]);
      expect(result.calls.fetchInviteMetadata).toEqual([FLAG]);
      expect(result.calls.joinExistingFlag).toEqual([FLAG]);
      expect(result.calls.biteInvite).toEqual([]);
    }
  });

  it('refuses a legacy flag link the provider does not know', async () => {
    const input = `https://invite.tlon.io/${FLAG}`;
    const result = await runWith(['--invite', input], {
      metadata: async () => ({ kind: 'not-found' }),
    });
    expect(result.code).toBe(1);
    expect(result.err).toBe(
      `Error: Not an invite: the invite service does not know ${input}.\n`
    );
    expect(result.calls.joinExistingFlag).toEqual([]);
  });

  it('refuses a DM link before resolving credentials', async () => {
    const result = await runWith([
      '--invite',
      'https://invite.tlon.io/dm-~zod',
    ]);
    expect(result.code).toBe(1);
    expect(result.err).toBe(
      'Error: https://invite.tlon.io/dm-~zod is a DM link to ~zod, not a group invite.\n'
    );
    expect(result.calls.getResolvedShip).toBe(0);
  });

  it('rejects anything else as a usage error before authenticating', async () => {
    for (const input of [
      'https://evil.example/0vabc',
      `https://invite.tlon.io.evil/${TOKEN}`,
      'hello',
      '0vZZZ',
      `https://invite.tlon.io@evil.example/${TOKEN}`,
      'https://invite.tlon.io/0vZZZ',
      'https://evil.example/?inviteToken=0vZZZ',
      'https://evil.example/?inviteToken=%E0%A4%A',
    ]) {
      const result = await runWith(['--invite', input]);
      expect(result.code).toBe(1);
      expect(result.err).toStartWith(
        `Error: Not an invite link or token: ${input}\n\n${JOIN_HELP}`
      );
      expect(result.calls.authenticate).toBe(0);
      expectNoNetwork(result.calls);
    }
  });

  it('rejects malformed arguments with the join help', async () => {
    const cases: Array<[string[], string]> = [
      [['--invite'], '--invite requires an invite URL or token'],
      [['--invite='], '--invite requires an invite URL or token'],
      [['--invite', '   '], '--invite requires an invite URL or token'],
      [['--invite', '--self'], '--invite requires an invite URL or token'],
      [[], '--invite requires an invite URL or token'],
      [
        [FLAG, '--invite', TOKEN],
        'Use either <group-id> or --invite, not both',
      ],
      [
        ['--invite', TOKEN, '--invite', TOKEN],
        '--invite was given more than once',
      ],
      [['--invite', TOKEN, '--bogus'], 'Unknown option: --bogus'],
    ];
    for (const [args, message] of cases) {
      const result = await runWith(args);
      expect({ args, code: result.code }).toEqual({ args, code: 1 });
      expect(result.err).toBe(`Error: ${message}\n\n${JOIN_HELP}\n`);
      expect(result.calls.getResolvedShip).toBe(0);
    }
  });

  it('prints help for -h/--help anywhere', async () => {
    for (const args of [
      ['--help'],
      ['--invite', TOKEN, '--help'],
      ['-h', '--invite', TOKEN],
      ['--invite', '--help'],
    ]) {
      const result = await runWith(args);
      expect(result.code).toBe(0);
      expect(result.out).toBe(`${JOIN_HELP}\n`);
      expect(result.calls.getResolvedShip).toBe(0);
    }
    expect(JOIN_HELP).toStartWith('Usage: tlon groups join');
  });
});

describe('join --invite ordering and metadata', () => {
  it('resolves the ship and authenticates before the first fetch', async () => {
    const result = await runWith(['--invite', LINK]);
    expect(result.sequence.slice(0, 3)).toEqual([
      'getResolvedShip',
      'authenticate',
      'fetchInviteMetadata',
    ]);
  });

  it('never fetches when credentials or authentication fail', async () => {
    const noShip = makeDeps({ resolvedShipError: new Error('no config') });
    await expect(run(['--invite', LINK], noShip.deps)).rejects.toThrow(
      'no config'
    );
    expectNoNetwork(noShip.calls);

    const noAuth = makeDeps({
      authenticate: async () => {
        throw new Error('auth failed');
      },
    });
    await expect(run(['--invite', LINK], noAuth.deps)).rejects.toThrow(
      'auth failed'
    );
    expectNoNetwork(noAuth.calls);
  });

  it('reports an unknown or revoked token without biting', async () => {
    const result = await runWith(['--invite', LINK], {
      metadata: async () => ({ kind: 'not-found' }),
    });
    expect(result.code).toBe(1);
    expect(result.err).toBe(
      `Error: Invite link not found (revoked or unknown): ${TOKEN}\n`
    );
    expect(result.calls.biteInvite).toEqual([]);
  });

  it('rejects unusable metadata', async () => {
    const unusable = [
      { ...GROUP_FIELDS, inviterUserId: '' },
      { ...GROUP_FIELDS, inviterUserId: '~notaship1' },
      { ...GROUP_FIELDS, invitedGroupId: 'garbage' },
      { ...GROUP_FIELDS, invitedGroupId: '' },
    ];
    for (const fields of unusable) {
      const result = await runWith(['--invite', LINK], { fields });
      expect(result.code).toBe(1);
      expect(result.err).toBe(
        `Error: Invite service returned unusable metadata for invite ${TOKEN}.\n`
      );
      expect(result.calls.getGroupState).toEqual([]);
    }
  });

  it('refuses a deleted group before touching group state', async () => {
    const result = await runWith(['--invite', LINK], {
      fields: { ...GROUP_FIELDS, invitedGroupDeleted: true },
    });
    expect(result.code).toBe(1);
    expect(result.err).toBe(
      `Error: The group for this invite (${FLAG}) has been deleted.\n`
    );
    expect(result.calls.getGroupState).toEqual([]);
    expect(result.calls.biteInvite).toEqual([]);
    expect(result.calls.joinGroup).toEqual([]);
  });

  it('treats an absent inviteType as a group invite when a group is named', async () => {
    const fields = without(GROUP_FIELDS, 'inviteType');
    const result = await runWith(['--invite', LINK], {
      fields,
      states: [state({ privacy: 'public' })],
    });
    expect(result.code).toBe(0);
    expect(result.calls.joinGroup.map((call) => call.flag)).toEqual([FLAG]);

    const empty = await runWith(['--invite', LINK], {
      fields: without(fields, 'invitedGroupId'),
    });
    expect(empty.code).toBe(1);
    expect(empty.err).toBe(`Error: Not an invite link or token: ${LINK}\n`);
  });

  it('treats an explicit group invite naming the personal sentinel as a group', async () => {
    const result = await runWith(['--invite', LINK], {
      fields: { ...GROUP_FIELDS, invitedGroupId: '~zod/personal-invite-link' },
      states: [state({ privacy: 'public' })],
      preview: async () => 'public',
    });
    expect(result.calls.getGroupState).toEqual(['~zod/personal-invite-link']);
    expect(result.calls.addContact).toEqual([]);
  });
});

describe('join --invite personal invites', () => {
  it('adds the inviter as a contact and joins nothing', async () => {
    const result = await runWith(['--invite', LINK], {
      fields: PERSONAL_FIELDS,
    });
    expect(result.code).toBe(0);
    expect(result.calls.addContact).toEqual(['~nec']);
    expect(result.calls.joinGroup).toEqual([]);
    expect(result.calls.biteInvite).toEqual([]);
    expect(result.calls.getGroupState).toEqual([]);
    expect(result.out).toBe(
      'Personal invite from ~nec; added ~nec as a contact.\n'
    );
    expect(result.err).toBe('Personal invite from ~nec as ~ten\n');
  });

  it('needs no group id', async () => {
    const absent = without(PERSONAL_FIELDS, 'invitedGroupId');
    for (const fields of [absent, { ...absent, invitedGroupId: '' }]) {
      const result = await runWith(['--invite', LINK], { fields });
      expect(result.code).toBe(0);
      expect(result.out).toBe(
        'Personal invite from ~nec; added ~nec as a contact.\n'
      );
    }
  });
});

describe('join --invite group invites', () => {
  it('reports an existing membership without biting or joining', async () => {
    const result = await runWith(['--invite', LINK], {
      states: [state({ member: true })],
    });
    expect(result.code).toBe(0);
    expect(result.out).toBe(`Already a member of ${FLAG}.\n`);
    expect(result.calls.biteInvite).toEqual([]);
    expect(result.calls.joinGroup).toEqual([]);
    expect(result.err).toBe(`Invite from ~nec for ${FLAG} as ~ten\n`);
  });

  it('accepts an invite already held, without biting', async () => {
    const result = await runWith(['--invite', LINK], {
      states: [state({ haveInvite: true })],
    });
    expect(result.code).toBe(0);
    expect(result.calls.joinGroup.map((call) => call.flag)).toEqual([FLAG]);
    expect(result.calls.biteInvite).toEqual([]);
    expect(result.out).toBe(
      `Invite accepted; joining ${FLAG}. Sync may take a moment to show membership.\n`
    );
  });

  it('bites a public group, then joins at once without polling', async () => {
    const viaPreview = await runWith(['--invite', LINK], {
      states: [state({ privacy: null })],
      preview: async () => 'public',
    });
    expect(viaPreview.code).toBe(0);
    expect(viaPreview.sequence).toEqual([
      'getResolvedShip',
      'authenticate',
      'fetchInviteMetadata',
      'getGroupState',
      'getPreviewPrivacy',
      'biteInvite',
      'joinGroup',
    ]);
    expect(viaPreview.calls.getPreviewPrivacy).toEqual([[FLAG, 4_000]]);
    expect(viaPreview.calls.biteInvite).toEqual([[TOKEN, '~ten']]);
    expect(viaPreview.calls.joinGroup).toEqual([{ flag: FLAG, at: 0 }]);
    expect(viaPreview.out).toBe(
      `Joining ${FLAG}. Sync may take a moment to show membership.\n`
    );
    expect(viaPreview.err).toBe(`Invite from ~nec for ${FLAG} as ~ten\n`);

    // A stored "public" is confirmed by one fresh preview first.
    const viaForeign = await runWith(['--invite', LINK], {
      states: [state({ privacy: 'public' })],
      preview: async () => 'public',
    });
    expect(viaForeign.calls.getPreviewPrivacy).toEqual([[FLAG, 4_000]]);
    expect(viaForeign.calls.biteInvite).toEqual([[TOKEN, '~ten']]);
    expect(viaForeign.calls.getGroupState).toHaveLength(1);
    expect(viaForeign.calls.joinGroup).toEqual([{ flag: FLAG, at: 0 }]);
  });

  it('still joins a public group when the bite times out or fails', async () => {
    const cases: Array<[Options['bite'], string, number]> = [
      [() => never(), 'timed out', 5_000],
      [
        async () => {
          throw new Error('provider down');
        },
        'provider down',
        0,
      ],
      [async () => ({ kind: 'not-found' }), 'invite not found', 0],
    ];
    for (const [bite, reason, at] of cases) {
      const result = await runWith(['--invite', LINK], {
        states: [state({ privacy: 'public' })],
        preview: async () => 'public',
        bite,
      });
      expect(result.code).toBe(0);
      expect(result.calls.joinGroup).toEqual([{ flag: FLAG, at }]);
      expect(result.calls.getGroupState).toHaveLength(1);
      expect(result.err).toContain(
        `Could not notify ~nec's ship of the invite (${reason}); joining anyway.\n`
      );
      expect(result.out).toBe(
        `Joining ${FLAG}. Sync may take a moment to show membership.\n`
      );
    }
  });

  it('bites when a fresh preview contradicts a stored public one', async () => {
    for (const fresh of ['private', 'secret'] as const) {
      const result = await runWith(['--invite', LINK], {
        states: [state({ privacy: 'public' }), state({ haveInvite: true })],
        preview: async () => fresh,
      });
      expect(result.calls.getPreviewPrivacy).toHaveLength(1);
      expect(result.calls.biteInvite).toEqual([[TOKEN, '~ten']]);
      expect(result.out).toStartWith('Invite accepted;');
    }
  });

  it('joins a group a fresh preview shows public despite a stored secret or private one', async () => {
    for (const stored of ['secret', 'private'] as const) {
      const result = await runWith(['--invite', LINK], {
        states: [state({ privacy: stored })],
        preview: async () => 'public',
      });
      expect(result.code).toBe(0);
      expect(result.calls.getPreviewPrivacy).toEqual([[FLAG, 4_000]]);
      expect(result.calls.biteInvite).toEqual([[TOKEN, '~ten']]);
      expect(result.calls.getGroupState).toHaveLength(1);
      expect(result.calls.requestInvite).toEqual([]);
      expect(result.calls.joinGroup).toEqual([{ flag: FLAG, at: 0 }]);
    }
  });

  it('keeps a stored private preview that cannot be refreshed: requests an invite at the deadline', async () => {
    const result = await runWith(['--invite', LINK], {
      preview: () => never(),
    });
    expect(result.calls.getPreviewPrivacy).toHaveLength(1);
    expect(result.calls.biteInvite).toEqual([[TOKEN, '~ten']]);
    expect(result.calls.joinGroup).toEqual([]);
    expect(result.calls.requestInvite).toEqual([{ flag: FLAG, at: 25_000 }]);
    expect(result.out).toBe(
      `${NOT_ARRIVED} Requested an invite to ${FLAG} instead.\n`
    );
  });

  it('keeps a stored public preview that cannot be refreshed: bites, then joins at once', async () => {
    const result = await runWith(['--invite', LINK], {
      states: [state({ privacy: 'public' }), state({ privacy: 'public' })],
      preview: () => never(),
    });
    expect(result.calls.getPreviewPrivacy).toHaveLength(1);
    expect(result.calls.biteInvite).toEqual([[TOKEN, '~ten']]);
    expect(result.calls.getGroupState).toHaveLength(1);
    expect(result.calls.joinGroup).toEqual([{ flag: FLAG, at: 4_000 }]);
    expect(result.out).toBe(
      `Joining ${FLAG}. Sync may take a moment to show membership.\n`
    );
  });

  it('bites, polls, and accepts an invite that arrives', async () => {
    const result = await runWith(['--invite', LINK], {
      states: [state(), state(), state({ haveInvite: true })],
    });
    expect(result.code).toBe(0);
    expect(result.sequence).toEqual([
      'getResolvedShip',
      'authenticate',
      'fetchInviteMetadata',
      'getGroupState',
      'getPreviewPrivacy',
      'biteInvite',
      'getGroupState',
      'sleep(1000)',
      'getGroupState',
      'joinGroup',
    ]);
    expect(result.calls.biteInvite).toEqual([[TOKEN, '~ten']]);
    expect(result.out).toBe(
      `Invite accepted; joining ${FLAG}. Sync may take a moment to show membership.\n`
    );
    expect(result.err).toContain(
      "Asking ~nec's ship to send the invite; waiting up to 25s...\n"
    );
  });

  it('stops polling as joined when the invite is accepted elsewhere', async () => {
    // The foreign record goes away mid-poll, then membership appears.
    const result = await runWith(['--invite', LINK], {
      states: [
        state(),
        state(),
        state({ privacy: null }),
        state({ member: true, privacy: null }),
      ],
    });
    expect(result.code).toBe(0);
    expect(result.calls.getGroupState).toHaveLength(4);
    expect(result.calls.joinGroup).toEqual([]);
    expect(result.calls.requestInvite).toEqual([]);
    expect(result.clock.now).toBe(2_000);
    expect(result.out).toBe(`Already a member of ${FLAG}.\n`);
  });

  it('requests an invite to a private group once the wait runs out', async () => {
    const result = await runWith(['--invite', LINK]);
    expect(result.code).toBe(0);
    expect(result.calls.joinGroup).toEqual([]);
    expect(result.calls.requestInvite).toEqual([{ flag: FLAG, at: 25_000 }]);
    expect(result.out).toBe(
      `${NOT_ARRIVED} Requested an invite to ${FLAG} instead.\n`
    );
  });

  it('does not re-request when an invite is already requested', async () => {
    const result = await runWith(['--invite', LINK], {
      states: [state({ haveRequestedInvite: true })],
    });
    expect(result.code).toBe(0);
    expect(result.calls.biteInvite).toHaveLength(1);
    expect(result.calls.requestInvite).toEqual([]);
    expect(result.out).toBe(
      `${NOT_ARRIVED} An invite to ${FLAG} is already requested.\n`
    );
  });

  it('keeps the last successful "requested" reading through failed reads', async () => {
    const failedAfter = await runWith(['--invite', LINK], {
      states: [
        state(),
        state({ haveRequestedInvite: true }),
        { ok: false, error: 'boom' },
      ],
    });
    expect(failedAfter.calls.requestInvite).toEqual([]);
    expect(failedAfter.out).toContain('is already requested');

    const clearedAfter = await runWith(['--invite', LINK], {
      states: [state(), state({ haveRequestedInvite: true }), state()],
    });
    expect(clearedAfter.calls.requestInvite).toHaveLength(1);
  });

  it('reports a secret or unknown group as pending, sending nothing more', async () => {
    for (const options of [
      { states: [state({ privacy: 'secret' })] },
      { states: [state({ privacy: null })] },
    ] satisfies Options[]) {
      const result = await runWith(['--invite', LINK], options);
      expect(result.code).toBe(0);
      expect(result.calls.requestInvite).toEqual([]);
      expect(result.calls.joinGroup).toEqual([]);
      expect(result.out).toBe(PENDING_LINE);
      expect(result.out).not.toContain(TOKEN);
    }
  });

  it('accepts an invite that arrives for a secret group', async () => {
    const result = await runWith(['--invite', LINK], {
      states: [state({ privacy: 'secret' }), state({ haveInvite: true })],
    });
    expect(result.calls.joinGroup.map((call) => call.flag)).toEqual([FLAG]);
    expect(result.out).toStartWith('Invite accepted;');
  });

  it('previews at most once across polls', async () => {
    const result = await runWith(['--invite', LINK], {
      states: [state({ privacy: null })],
    });
    expect(result.calls.getGroupState.length).toBeGreaterThan(5);
    expect(result.calls.getPreviewPrivacy).toHaveLength(1);
  });

  it('reports a bite for an unknown token without polling', async () => {
    const result = await runWith(['--invite', LINK], {
      bite: async () => ({ kind: 'not-found' }),
    });
    expect(result.code).toBe(1);
    expect(result.err).toContain(
      `Error: Invite link not found (revoked or unknown): ${TOKEN}\n`
    );
    expect(result.calls.getGroupState).toHaveLength(1);
  });

  it('surfaces a failed initial state read without biting', async () => {
    const result = await runWith(['--invite', LINK], {
      states: [{ ok: false, error: 'scry failed' }],
    });
    expect(result.code).toBe(1);
    expect(result.err).toContain(
      `Error: Could not read the invite state for ${FLAG} (scry failed).\n`
    );
    expect(result.calls.biteInvite).toEqual([]);
  });

  it('propagates failed join, request-invite and contact pokes', async () => {
    const fail = async () => {
      throw new Error('poke failed');
    };
    for (const options of [
      { states: [state({ haveInvite: true })], joinGroup: fail },
      { requestInvite: fail },
      { fields: PERSONAL_FIELDS, addContact: fail },
    ] satisfies Options[]) {
      const harness = makeDeps(options);
      await expect(run(['--invite', LINK], harness.deps)).rejects.toThrow(
        'poke failed'
      );
      expect(harness.stdout).toEqual([]);
    }
  });

  it('requests an invite when polling reveals an unknown group is private', async () => {
    const result = await runWith(['--invite', LINK], {
      states: [state({ privacy: null }), state({ privacy: 'private' })],
    });
    expect(result.calls.getPreviewPrivacy).toHaveLength(1);
    expect(result.calls.requestInvite).toEqual([{ flag: FLAG, at: 25_000 }]);
    expect(result.out).toBe(
      `${NOT_ARRIVED} Requested an invite to ${FLAG} instead.\n`
    );
  });

  it('keeps polling past a stale public preview and accepts a later invite', async () => {
    const result = await runWith(['--invite', LINK], {
      states: [
        state({ privacy: null }),
        state({ privacy: 'public' }),
        state({ privacy: 'public' }),
        state({ privacy: 'public', haveInvite: true }),
      ],
    });
    expect(result.calls.joinGroup).toEqual([{ flag: FLAG, at: 2_000 }]);
    expect(result.out).toBe(
      `Invite accepted; joining ${FLAG}. Sync may take a moment to show membership.\n`
    );
  });

  it('joins directly at the deadline when polling shows the group is public', async () => {
    const result = await runWith(['--invite', LINK], {
      states: [state({ privacy: null }), state({ privacy: 'public' })],
    });
    expect(result.code).toBe(0);
    expect(result.calls.biteInvite).toHaveLength(1);
    expect(result.calls.requestInvite).toEqual([]);
    expect(result.calls.joinGroup).toEqual([{ flag: FLAG, at: 25_000 }]);
    expect(result.out).toBe(
      `Joining ${FLAG}. Sync may take a moment to show membership.\n`
    );
  });

  it('follows a private-to-secret change to the unconfirmed outcome', async () => {
    const result = await runWith(['--invite', LINK], {
      states: [state({ privacy: 'private' }), state({ privacy: 'secret' })],
    });
    expect(result.calls.getGroupState.length).toBeGreaterThan(5);
    expect(result.calls.requestInvite).toEqual([]);
    expect(result.out).toBe(PENDING_LINE);
    expect(result.out).not.toContain(TOKEN);
  });

  it('keeps learned privacy through later failed reads', async () => {
    const result = await runWith(['--invite', LINK], {
      states: [
        state({ privacy: null }),
        state({ privacy: 'private' }),
        { ok: false, error: 'boom' },
      ],
    });
    expect(result.calls.requestInvite).toEqual([{ flag: FLAG, at: 25_000 }]);
  });

  it('keeps the last known privacy when a later read has no record', async () => {
    const result = await runWith(['--invite', LINK], {
      states: [
        state({ privacy: null }),
        state({ privacy: 'private' }),
        state({ privacy: null }),
      ],
    });
    expect(result.calls.requestInvite).toHaveLength(1);
  });

  it('accepts an invite that arrives for a group of unknown privacy', async () => {
    const result = await runWith(['--invite', LINK], {
      states: [state({ privacy: null }), state({ haveInvite: true })],
    });
    expect(result.calls.biteInvite).toHaveLength(1);
    expect(result.calls.joinGroup.map((call) => call.flag)).toEqual([FLAG]);
    expect(result.out).toStartWith('Invite accepted;');
  });

  it('runs the same with --self, as the resolved ship', async () => {
    const bare = await runWith(['--invite', LINK]);
    const self = await runWith(['--invite', LINK, '--self']);
    const leading = await runWith(['--self', '--invite', LINK]);
    for (const result of [self, leading]) {
      expect(result.code).toBe(bare.code);
      expect(result.out).toBe(bare.out);
      expect(result.sequence).toEqual(bare.sequence);
      expect(result.calls.biteInvite).toEqual([[TOKEN, '~ten']]);
    }
  });
});

describe('join --invite phase caps', () => {
  it('counts metadata time against the wait deadline', async () => {
    const result = await runWith(['--invite', LINK], {
      metadata: async (clock) => {
        clock.now += 10_000;
        return { kind: 'found', fields: GROUP_FIELDS };
      },
    });
    expect(result.calls.requestInvite).toEqual([{ flag: FLAG, at: 25_000 }]);
    expect(result.err).toContain('waiting up to 15s...');
  });

  it('fails as "nothing was sent" when authentication never settles', async () => {
    const result = await runWith(['--invite', LINK], {
      authenticate: () => never(),
    });
    expect(result.code).toBe(1);
    expect(result.err).toBe(`Error: ${BUDGET_EXHAUSTED_MESSAGE}\n`);
    expect(result.clock.now).toBe(20_000);
    expectNoNetwork(result.calls);
  });

  it('fails as "nothing was sent" when metadata or the first state read hang', async () => {
    const hungMetadata = await runWith(['--invite', LINK], {
      metadata: () => never(),
    });
    expect(hungMetadata.err).toBe(`Error: ${BUDGET_EXHAUSTED_MESSAGE}\n`);

    const hungScry = await runWith(['--invite', LINK], { states: ['hang'] });
    expect(hungScry.err).toContain(`Error: ${BUDGET_EXHAUSTED_MESSAGE}\n`);
    expect(hungScry.calls.biteInvite).toEqual([]);
    expect(hungScry.clock.now).toBe(20_000);
  });

  it('treats a hung preview as unknown privacy and still bites', async () => {
    const result = await runWith(['--invite', LINK], {
      states: [state({ privacy: null })],
      preview: () => never(),
    });
    expect(result.calls.biteInvite).toHaveLength(1);
    expect(result.out).toBe(PENDING_LINE);
    expect(result.out).not.toContain(TOKEN);
    expect(result.clock.now).toBe(25_000);
  });

  it('clips the preview to the remaining budget and stops before biting at the boundary', async () => {
    const result = await runWith(['--invite', LINK], {
      metadata: async (clock) => {
        clock.now += 17_000;
        return { kind: 'found', fields: GROUP_FIELDS };
      },
      states: [state({ privacy: null })],
      preview: () => never(),
    });
    expect(result.calls.getPreviewPrivacy).toEqual([[FLAG, 3_000]]);
    expect(result.code).toBe(1);
    expect(result.err).toContain(`Error: ${BUDGET_EXHAUSTED_MESSAGE}\n`);
    expect(result.calls.biteInvite).toEqual([]);
  });

  it('stays inside the hard stop when every phase runs long', async () => {
    const result = await runWith(['--invite', LINK], {
      authenticate: async (clock) => {
        clock.now += 2_000;
      },
      metadata: async (clock) => {
        clock.now += 5_000;
        return { kind: 'found', fields: GROUP_FIELDS };
      },
      states: [state({ privacy: null }), 'hang'],
      preview: async (clock) => {
        clock.now += 4_000;
        return 'private';
      },
      bite: () => never(),
      requestInvite: () => never(),
    });
    // auth 2s + metadata 5s + preview 4s + bite cap 5s = 16s; the hung poll
    // read ends at 25s, and the hung fallback poke at its 3s cap.
    expect(result.calls.requestInvite).toEqual([{ flag: FLAG, at: 25_000 }]);
    expect(result.code).toBe(1);
    expect(result.err).toContain(
      `Error: Timed out requesting an invite to ${FLAG}; it may still complete.\n`
    );
    expect(result.clock.now).toBe(28_000);
  });

  it('bounds the personal contact poke and the legacy flag-link join', async () => {
    const personal = await runWith(['--invite', LINK], {
      fields: PERSONAL_FIELDS,
      addContact: () => never(),
    });
    expect(personal.code).toBe(1);
    expect(personal.err).toContain(
      'Error: Timed out adding ~nec as a contact; it may still complete.\n'
    );
    expect(personal.clock.now).toBe(3_000);

    const flag = await runWith(['--invite', `https://invite.tlon.io/${FLAG}`], {
      fields: {},
      joinExistingFlag: () => never(),
    });
    expect(flag.code).toBe(1);
    expect(flag.err).toBe(
      `Error: Timed out joining ${FLAG}; it may still complete. Check with \`tlon groups list\` or run \`tlon groups join ${FLAG}\` again.\n`
    );
    expect(flag.clock.now).toBe(25_000);
  });

  it('bounds the join poke after an invite is found', async () => {
    const result = await runWith(['--invite', LINK], {
      states: [state({ privacy: 'public' })],
      preview: async () => 'public',
      joinGroup: () => never(),
    });
    expect(result.code).toBe(1);
    expect(result.err).toContain(
      `Error: Timed out joining ${FLAG}; it may still complete.\n`
    );
    expect(result.clock.now).toBe(3_000);
  });
});

describe('groups join routing', () => {
  it('routes to invite redemption only when --invite is present', () => {
    expect(isInviteJoin(['--invite', LINK])).toBe(true);
    expect(isInviteJoin([`--invite=${LINK}`, '--self'])).toBe(true);
    expect(isInviteJoin([FLAG])).toBe(false);
    expect(isInviteJoin([FLAG, '--self'])).toBe(false);
  });

  it('skips --self when reading a plain join group id', () => {
    expect(plainJoinGroupId([FLAG])).toBe(FLAG);
    expect(plainJoinGroupId([FLAG, '--self'])).toBe(FLAG);
    expect(plainJoinGroupId(['--self', FLAG])).toBe(FLAG);
    expect(plainJoinGroupId(['--self'])).toBeUndefined();
    expect(plainJoinGroupId([])).toBeUndefined();
  });
});
