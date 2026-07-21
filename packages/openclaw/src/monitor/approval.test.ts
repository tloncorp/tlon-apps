import { A2UI } from '@tloncorp/api';
import { describe, expect, it } from 'vitest';

import {
  APPROVAL_TTL_MS,
  type DisplayContext,
  type PendingApproval,
  buildApprovalA2UIBlob,
  buildPendingApprovalsA2UIBlob,
  buildPendingApprovalsResponse,
  createPendingApproval,
  emojiToApprovalAction,
  findPendingApproval,
  formatApprovalConfirmation,
  formatApprovalRequestNotification,
  formatBlockedList,
  formatPendingList,
  generateApprovalId,
  hasDuplicatePending,
  isExpired,
  normalizeNotificationId,
  removePendingApproval,
} from './approval.js';

// ---------------------------------------------------------------------------
// Short ID Generation
// ---------------------------------------------------------------------------

describe('generateApprovalId', () => {
  it('generates IDs with type prefix', () => {
    expect(generateApprovalId('dm')).toMatch(/^d[0-9a-f]{4}$/);
    expect(generateApprovalId('channel')).toMatch(/^c[0-9a-f]{4}$/);
    expect(generateApprovalId('group')).toMatch(/^g[0-9a-f]{4}$/);
  });

  it('avoids collisions with existing IDs', () => {
    const existing: string[] = [];
    for (let i = 0; i < 20; i++) {
      const id = generateApprovalId('dm', existing);
      expect(existing).not.toContain(id);
      existing.push(id);
    }
  });
});

describe('createPendingApproval', () => {
  it('passes existing IDs for collision avoidance', () => {
    const first = createPendingApproval({ type: 'dm', requestingShip: '~zod' });
    const second = createPendingApproval(
      { type: 'dm', requestingShip: '~bus' },
      [first.id]
    );
    expect(second.id).not.toBe(first.id);
  });

  it('stores groupTitle when provided', () => {
    const approval = createPendingApproval({
      type: 'group',
      requestingShip: '~zod',
      groupFlag: '~host/my-group',
      groupTitle: 'Garden Club',
    });
    expect(approval.groupTitle).toBe('Garden Club');
  });
});

// ---------------------------------------------------------------------------
// Approval Expiration
// ---------------------------------------------------------------------------

describe('isExpired', () => {
  it('returns false for fresh approvals', () => {
    const approval: PendingApproval = {
      id: 'da1b2',
      type: 'dm',
      requestingShip: '~zod',
      timestamp: Date.now(),
    };
    expect(isExpired(approval)).toBe(false);
  });

  it('returns true for approvals older than TTL', () => {
    const approval: PendingApproval = {
      id: 'da1b2',
      type: 'dm',
      requestingShip: '~zod',
      timestamp: Date.now() - APPROVAL_TTL_MS - 1,
    };
    expect(isExpired(approval)).toBe(true);
  });

  it('returns false for approvals at exactly TTL boundary', () => {
    const approval: PendingApproval = {
      id: 'da1b2',
      type: 'dm',
      requestingShip: '~zod',
      timestamp: Date.now() - APPROVAL_TTL_MS + 1000,
    };
    expect(isExpired(approval)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// findPendingApproval
// ---------------------------------------------------------------------------

describe('findPendingApproval', () => {
  const approvals: PendingApproval[] = [
    { id: 'da1b2', type: 'dm', requestingShip: '~zod', timestamp: Date.now() },
    {
      id: 'cc3d4',
      type: 'channel',
      requestingShip: '~bus',
      channelNest: 'chat/~host/general',
      timestamp: Date.now(),
    },
  ];

  it('finds by exact match', () => {
    expect(findPendingApproval(approvals, 'da1b2')?.id).toBe('da1b2');
    expect(findPendingApproval(approvals, 'cc3d4')?.id).toBe('cc3d4');
  });

  it('finds by prefix match when unambiguous', () => {
    expect(findPendingApproval(approvals, 'd')?.id).toBe('da1b2');
    expect(findPendingApproval(approvals, 'c')?.id).toBe('cc3d4');
  });

  it('returns undefined for ambiguous prefix', () => {
    const dupes: PendingApproval[] = [
      {
        id: 'da1b2',
        type: 'dm',
        requestingShip: '~zod',
        timestamp: Date.now(),
      },
      {
        id: 'da1b3',
        type: 'dm',
        requestingShip: '~bus',
        timestamp: Date.now(),
      },
    ];
    expect(findPendingApproval(dupes, 'da1b')).toBeUndefined();
  });

  it('returns most recent when no ID given', () => {
    expect(findPendingApproval(approvals)?.id).toBe('cc3d4');
  });

  it('returns undefined for empty list', () => {
    expect(findPendingApproval([])).toBeUndefined();
    expect(findPendingApproval([], 'da1b2')).toBeUndefined();
  });

  it('matches old-format long IDs', () => {
    const old: PendingApproval[] = [
      {
        id: 'dm-1234567890-abc12345',
        type: 'dm',
        requestingShip: '~zod',
        timestamp: Date.now(),
      },
    ];
    expect(findPendingApproval(old, 'dm-1234567890-abc12345')?.id).toBe(
      'dm-1234567890-abc12345'
    );
  });

  it('skips expired approvals', () => {
    const mixed: PendingApproval[] = [
      {
        id: 'da1b2',
        type: 'dm',
        requestingShip: '~zod',
        timestamp: Date.now() - APPROVAL_TTL_MS - 1,
      },
      {
        id: 'cc3d4',
        type: 'channel',
        requestingShip: '~bus',
        timestamp: Date.now(),
      },
    ];
    expect(findPendingApproval(mixed, 'da1b2')).toBeUndefined();
    expect(findPendingApproval(mixed, 'cc3d4')?.id).toBe('cc3d4');
  });
});

// ---------------------------------------------------------------------------
// Display Context Formatting
// ---------------------------------------------------------------------------

const ctx: DisplayContext = {
  contactNames: new Map([
    ['~sampel-palnet', 'Sam Palnet'],
    ['~littel-wolfur', 'Littel Wolfur'],
    ['~robin-dasler', 'Robin Dasler'],
    ['~zod', 'Zod'],
  ]),
  channelNames: new Map([['chat/~host/general', 'General']]),
  channelGroups: new Map([['chat/~host/general', '~host/cool-group']]),
  groupNames: new Map([['~host/cool-group', 'Garden Club']]),
};

describe('buildApprovalA2UIBlob', () => {
  it('builds approval cards with slash command actions', () => {
    for (const approval of [
      buildApprovalA2UIBlob({
        id: 'da1b2',
        type: 'dm',
        requestingShip: '~sampel-palnet',
        timestamp: 1,
        messagePreview: 'Hello, I would like to chat with your bot.',
      }),
      buildApprovalA2UIBlob({
        id: 'c3d4e',
        type: 'channel',
        requestingShip: '~littel-wolfur',
        channelNest: 'chat/~zod/design',
        timestamp: 1,
        messagePreview: '@bot can you review this build before I merge?',
      }),
      buildApprovalA2UIBlob({
        id: 'g5f6a',
        type: 'group',
        requestingShip: '~robin-dasler',
        groupFlag: '~robin-dasler/garden-club',
        groupTitle: 'Garden Club',
        timestamp: 1,
      }),
    ]) {
      expect(A2UI.validateBlobEntry(approval)).toBe(true);
      const text = JSON.stringify(approval);
      expect(text).toContain('/allow ');
      expect(text).toContain('/reject ');
      expect(text).toContain('/ban ');
      if (
        text.includes('Hello, I would') ||
        text.includes('@bot can you review')
      ) {
        expect(text).toContain('Message: ');
      }
      expect(text).not.toContain('New approval request');
    }
  });

  it('adds view message navigation for dm and channel approvals with source messages', () => {
    const dm = buildApprovalA2UIBlob({
      id: 'da1b2',
      type: 'dm',
      requestingShip: '~sampel-palnet',
      timestamp: 1,
      messagePreview: 'Hello, I would like to chat with your bot.',
      originalMessage: {
        messageId: '170.141.184.507',
        messageText: 'Hello, I would like to chat with your bot.',
        messageContent: [],
        timestamp: 1,
      },
    });
    const channel = buildApprovalA2UIBlob(
      {
        id: 'c3d4e',
        type: 'channel',
        requestingShip: '~littel-wolfur',
        channelNest: 'chat/~host/general',
        timestamp: 1,
        messagePreview: '@bot can you review this build before I merge?',
        originalMessage: {
          messageId: '170.141.184.621',
          messageText: '@bot can you review this build before I merge?',
          messageContent: [],
          timestamp: 1,
          parentId: '170.141.184.600',
          parentAuthorId: '~host',
        },
      },
      ctx
    );

    expect(A2UI.validateBlobEntry(dm)).toBe(true);
    expect(A2UI.validateBlobEntry(channel)).toBe(true);
    expect(JSON.stringify(dm)).toContain('View message');
    expect(JSON.stringify(dm)).toContain('"name":"tlon.navigate"');
    expect(JSON.stringify(dm)).toContain('"channelId":"~sampel-palnet"');
    expect(JSON.stringify(dm)).toContain('"postId":"170.141.184.507"');
    expect(JSON.stringify(channel)).toContain(
      '"channelId":"chat/~host/general"'
    );
    expect(JSON.stringify(channel)).toContain('"parentId":"170.141.184.600"');
    expect(JSON.stringify(channel)).toContain('"parentAuthorId":"~host"');
    expect(JSON.stringify(channel)).toContain('"groupId":"~host/cool-group"');
  });

  it('hides dm source navigation when the recipient cannot see bot DMs, but keeps channel sources linked', () => {
    const sourceMessage = {
      messageId: '170.141.184.507',
      messageText: 'Please let me in',
      messageContent: [],
      timestamp: 1,
    };
    const dm = buildApprovalA2UIBlob(
      {
        id: 'da1b2',
        type: 'dm',
        requestingShip: '~sampel-palnet',
        timestamp: 1,
        originalMessage: sourceMessage,
      },
      undefined,
      { recipientSeesBotDms: false }
    );
    const channel = buildApprovalA2UIBlob(
      {
        id: 'c3d4e',
        type: 'channel',
        requestingShip: '~littel-wolfur',
        channelNest: 'chat/~host/general',
        timestamp: 1,
        originalMessage: sourceMessage,
      },
      ctx,
      { recipientSeesBotDms: false }
    );

    expect(A2UI.validateBlobEntry(dm)).toBe(true);
    expect(JSON.stringify(dm)).not.toContain('View message');
    expect(JSON.stringify(dm)).not.toContain('tlon.navigate');

    // The channel-mention source lives in the group channel, not in the
    // bot's DM history, so a separate owner can still jump to it (TLON-6198).
    expect(A2UI.validateBlobEntry(channel)).toBe(true);
    expect(JSON.stringify(channel)).toContain('View message');
    expect(JSON.stringify(channel)).toContain('"name":"tlon.navigate"');
    expect(JSON.stringify(channel)).toContain(
      '"channelId":"chat/~host/general"'
    );
  });

  it('does not add view message navigation to group invites', () => {
    const approval = buildApprovalA2UIBlob({
      id: 'g5f6a',
      type: 'group',
      requestingShip: '~robin-dasler',
      groupFlag: '~robin-dasler/garden-club',
      groupTitle: 'Garden Club',
      timestamp: 1,
    });

    expect(A2UI.validateBlobEntry(approval)).toBe(true);
    expect(JSON.stringify(approval)).not.toContain('View message');
    expect(JSON.stringify(approval)).not.toContain('tlon.navigate');
  });

  it('formats the visible notification text by request type', () => {
    expect(
      formatApprovalRequestNotification(
        {
          type: 'dm',
          requestingShip: '~sampel-palnet',
        },
        ctx
      )
    ).toBe('DM request from Sam Palnet (~sampel-palnet)');
    expect(
      formatApprovalRequestNotification(
        {
          type: 'channel',
          requestingShip: '~littel-wolfur',
        },
        ctx
      )
    ).toBe('Channel mention request from Littel Wolfur (~littel-wolfur)');
    expect(
      formatApprovalRequestNotification(
        {
          type: 'group',
          requestingShip: '~robin-dasler',
        },
        ctx
      )
    ).toBe('Group invite request from Robin Dasler (~robin-dasler)');
  });

  it('uses request type as the card eyebrow', () => {
    expect(
      JSON.stringify(
        buildApprovalA2UIBlob({
          id: 'da1b2',
          type: 'dm',
          requestingShip: '~sampel-palnet',
          timestamp: 1,
        })
      )
    ).toContain('DM access');
    expect(
      JSON.stringify(
        buildApprovalA2UIBlob({
          id: 'cc3d4',
          type: 'channel',
          requestingShip: '~sampel-palnet',
          channelNest: 'chat/~host/general',
          timestamp: 1,
        })
      )
    ).toContain('Channel access');
    expect(
      JSON.stringify(
        buildApprovalA2UIBlob({
          id: 'g5f6e',
          type: 'group',
          requestingShip: '~sampel-palnet',
          groupFlag: '~host/cool-group',
          timestamp: 1,
        })
      )
    ).toContain('Group invite');
  });

  it('shows labeled metadata on dm cards', () => {
    const approval = buildApprovalA2UIBlob({
      id: 'da1b2',
      type: 'dm',
      requestingShip: '~sampel-palnet',
      timestamp: 1,
    });

    expect(A2UI.validateBlobEntry(approval)).toBe(true);
    expect(JSON.stringify(approval)).toContain('Sender: ~sampel-palnet');
  });

  it('uses display context for channel and group labels', () => {
    const approval = buildApprovalA2UIBlob(
      {
        id: 'cc3d4',
        type: 'channel',
        requestingShip: '~zod',
        channelNest: 'chat/~host/general',
        timestamp: 1,
      },
      ctx
    );

    expect(A2UI.validateBlobEntry(approval)).toBe(true);
    const text = JSON.stringify(approval);
    expect(text).toContain('Let the bot reply to Zod in General?');
    expect(text).toContain('Sender: Zod (~zod)');
    expect(text).toContain('Channel: General');
    expect(text).toContain('Group: Garden Club');
    expect(text).not.toContain('General in Garden Club (chat/~host/general)');
    expect(text).toContain('/allow cc3d4');
  });

  it('falls back to channel name when group name is unavailable', () => {
    const approval = buildApprovalA2UIBlob(
      {
        id: 'cc3d4',
        type: 'channel',
        requestingShip: '~zod',
        channelNest: 'chat/~host/general',
        timestamp: 1,
      },
      { contactNames: ctx.contactNames, channelNames: ctx.channelNames }
    );

    expect(A2UI.validateBlobEntry(approval)).toBe(true);
    const text = JSON.stringify(approval);
    expect(text).toContain('Let the bot reply to Zod in General?');
    expect(text).toContain('Sender: Zod (~zod)');
    expect(text).toContain('Channel: General');
    expect(text).not.toContain('general (chat/~host/general)');
  });

  it('shows labeled metadata on group invite cards', () => {
    const approval = buildApprovalA2UIBlob(
      {
        id: 'g5f6e',
        type: 'group',
        requestingShip: '~robin-dasler',
        groupFlag: '~robin-dasler/garden-club',
        groupTitle: 'Garden Club',
        timestamp: 1,
      },
      ctx
    );

    expect(A2UI.validateBlobEntry(approval)).toBe(true);
    const text = JSON.stringify(approval);
    expect(text).toContain('Let the bot join Garden Club?');
    expect(text).toContain('Inviter: Robin Dasler (~robin-dasler)');
    expect(text).toContain('Group: Garden Club');
  });

  it('keeps the group flag visible when no group title is available', () => {
    const approval = buildApprovalA2UIBlob({
      id: 'g5f6e',
      type: 'group',
      requestingShip: '~robin-dasler',
      groupFlag: '~robin-dasler/private-garden',
      timestamp: 1,
    });

    expect(A2UI.validateBlobEntry(approval)).toBe(true);
    const text = JSON.stringify(approval);
    expect(text).toContain('Let the bot join ~robin-dasler/private-garden?');
    expect(text).toContain('Group: ~robin-dasler/private-garden');
    expect(text).not.toContain('this group');
  });
});

describe('buildPendingApprovalsA2UIBlob', () => {
  it('builds a pending requests card with actions for each approval', () => {
    const blob = buildPendingApprovalsA2UIBlob(
      [
        {
          id: 'da1b2',
          type: 'dm',
          requestingShip: '~zod',
          messagePreview: 'Can you help me find the launch notes?',
          timestamp: Date.now(),
        },
        {
          id: 'cc3d4',
          type: 'channel',
          requestingShip: '~sampel-palnet',
          channelNest: 'chat/~host/general',
          timestamp: Date.now(),
        },
      ],
      ctx
    );

    expect(blob).toBeDefined();
    expect(A2UI.validateBlobEntry(blob)).toBe(true);
    const text = JSON.stringify(blob);
    expect(text).toContain('2 approval requests');
    expect(text).toContain('DM from Zod');
    expect(text).toContain('Sender: Zod (~zod)');
    expect(text).toContain('Message: ');
    expect(text).toContain('Channel access for Sam Palnet');
    expect(text).toContain(
      'Channel: General in Garden Club (chat/~host/general)'
    );
    expect(text).toContain('/allow da1b2');
    expect(text).toContain('/reject cc3d4');
    expect(text).toContain('/ban cc3d4');
  });

  it('adds view message navigation for approvals with source messages', () => {
    const blob = buildPendingApprovalsA2UIBlob(
      [
        {
          id: 'cc3d4',
          type: 'channel',
          requestingShip: '~sampel-palnet',
          channelNest: 'chat/~host/general',
          timestamp: Date.now(),
          originalMessage: {
            messageId: '170.141.184.621',
            messageText: '@bot can you take a look?',
            messageContent: [],
            timestamp: 1,
            parentId: '170.141.184.600',
            parentAuthorId: '~host',
          },
        },
      ],
      ctx
    );

    expect(blob).toBeDefined();
    expect(A2UI.validateBlobEntry(blob)).toBe(true);
    const text = JSON.stringify(blob);
    expect(text).toContain('View message');
    expect(text).toContain('"name":"tlon.navigate"');
    expect(text).toContain('"channelId":"chat/~host/general"');
    expect(text).toContain('"postId":"170.141.184.621"');
    expect(text).toContain('"parentId":"170.141.184.600"');
  });

  it('hides dm sources in the pending card when the recipient cannot see bot DMs', () => {
    const originalMessage = {
      messageId: '170.141.184.507',
      messageText: 'Hello there',
      messageContent: [],
      timestamp: 1,
    };
    const blob = buildPendingApprovalsA2UIBlob(
      [
        {
          id: 'da1b2',
          type: 'dm',
          requestingShip: '~zod',
          timestamp: Date.now(),
          originalMessage,
        },
        {
          id: 'cc3d4',
          type: 'channel',
          requestingShip: '~sampel-palnet',
          channelNest: 'chat/~host/general',
          timestamp: Date.now(),
          originalMessage,
        },
      ],
      ctx,
      { recipientSeesBotDms: false }
    );

    expect(blob).toBeDefined();
    expect(A2UI.validateBlobEntry(blob)).toBe(true);
    const text = JSON.stringify(blob);
    // Channel source stays linked; the dm item gets no view button.
    expect(text).toContain('"channelId":"chat/~host/general"');
    expect(text).not.toContain('"channelId":"~zod"');
    expect(text).toContain('"id":"item1View"');
    expect(text).not.toContain('"id":"item0View"');
  });

  it('omits the card when there are no active approvals', () => {
    expect(buildPendingApprovalsA2UIBlob([], ctx)).toBeUndefined();
    expect(
      buildPendingApprovalsA2UIBlob(
        [
          {
            id: 'da1b2',
            type: 'dm',
            requestingShip: '~zod',
            timestamp: Date.now() - APPROVAL_TTL_MS - 1,
          },
        ],
        ctx
      )
    ).toBeUndefined();
  });

  it('omits the card for five or more active approvals', () => {
    const approvals = Array.from({ length: 5 }, (_, index) => ({
      id: `d${index}`,
      type: 'dm' as const,
      requestingShip: `~ship${index}`,
      timestamp: Date.now(),
    }));

    expect(buildPendingApprovalsA2UIBlob(approvals, ctx)).toBeUndefined();
  });
});

describe('buildPendingApprovalsResponse', () => {
  const approval: PendingApproval = {
    id: 'da1b2',
    type: 'dm',
    requestingShip: '~zod',
    timestamp: Date.now(),
  };

  it('keeps a text fallback when returning an A2UI card', () => {
    const response = buildPendingApprovalsResponse(
      [approval],
      ctx,
      () => 'serialized-card'
    );

    expect(response).toMatchObject({
      mode: 'ui',
      blob: 'serialized-card',
    });
    expect(response.text).toContain('Zod (~zod)');
    expect(response.text).toContain('/allow');
  });

  it('falls back to text when the card cannot be serialized', () => {
    const response = buildPendingApprovalsResponse(
      [approval],
      ctx,
      () => undefined
    );

    expect(response.mode).toBe('text');
    expect(response.text).toContain('Zod (~zod)');
  });

  it('falls back to text when display values make the card invalid', () => {
    let serializeCalled = false;
    let fallbackError: unknown;
    const response = buildPendingApprovalsResponse(
      [approval],
      {
        ...ctx,
        contactNames: new Map([['~zod', 'Z'.repeat(1_001)]]),
      },
      () => {
        serializeCalled = true;
        return 'serialized-card';
      },
      (error) => {
        fallbackError = error;
      }
    );

    expect(response.mode).toBe('text');
    expect(serializeCalled).toBe(false);
    expect(fallbackError).toBeInstanceOf(Error);
  });
});

describe('formatApprovalConfirmation', () => {
  it('shows ship in confirmation', () => {
    const approval: PendingApproval = {
      id: 'da1b2',
      type: 'dm',
      requestingShip: '~sampel-palnet',
      timestamp: 1,
    };
    expect(formatApprovalConfirmation(approval, 'approve', ctx)).toContain(
      'Sam Palnet (~sampel-palnet)'
    );
    expect(formatApprovalConfirmation(approval, 'deny', ctx)).toContain(
      'Sam Palnet (~sampel-palnet)'
    );
    expect(formatApprovalConfirmation(approval, 'block', ctx)).toContain(
      'Sam Palnet (~sampel-palnet)'
    );
  });

  it('channel confirmation shows channel name', () => {
    const approval: PendingApproval = {
      id: 'cc3d4',
      type: 'channel',
      requestingShip: '~zod',
      channelNest: 'chat/~host/general',
      timestamp: 1,
    };
    expect(formatApprovalConfirmation(approval, 'approve', ctx)).toContain(
      'General in Garden Club (chat/~host/general)'
    );
  });

  it('group confirmation shows group name', () => {
    const approval: PendingApproval = {
      id: 'g5f6e',
      type: 'group',
      requestingShip: '~zod',
      groupFlag: '~host/cool-group',
      timestamp: 1,
    };
    expect(formatApprovalConfirmation(approval, 'approve', ctx)).toContain(
      'Garden Club (~host/cool-group)'
    );
  });

  it('works without context', () => {
    const approval: PendingApproval = {
      id: 'da1b2',
      type: 'dm',
      requestingShip: '~zod',
      timestamp: 1,
    };
    const text = formatApprovalConfirmation(approval, 'approve');
    expect(text).toContain('~zod');
  });
});

// ---------------------------------------------------------------------------
// Blocked & Pending List Formatting
// ---------------------------------------------------------------------------

describe('formatBlockedList', () => {
  it('shows empty state', () => {
    expect(formatBlockedList([])).toBe('No users are currently blocked.');
  });

  it('shows ships', () => {
    const text = formatBlockedList(['~sampel-palnet', '~zod']);
    expect(text).toContain('~sampel-palnet');
    expect(text).toContain('~zod');
    expect(text).toContain('Blocked users (2):');
    expect(text).toContain('`/unban ~sampel-palnet`');
  });
});

describe('formatPendingList', () => {
  it('shows empty state', () => {
    expect(formatPendingList([])).toBe('No pending approval requests.');
  });

  it('shows short IDs with # prefix', () => {
    const approvals: PendingApproval[] = [
      {
        id: 'da1b2',
        type: 'dm',
        requestingShip: '~zod',
        timestamp: Date.now(),
      },
    ];
    const text = formatPendingList(approvals);
    expect(text).toContain('#da1b2');
  });

  it('shows message previews', () => {
    const approvals: PendingApproval[] = [
      {
        id: 'da1b2',
        type: 'dm',
        requestingShip: '~zod',
        messagePreview: 'Hello there',
        timestamp: Date.now(),
      },
    ];
    const text = formatPendingList(approvals);
    expect(text).toContain('"Hello there"');
  });

  it('shows ship in pending list', () => {
    const approvals: PendingApproval[] = [
      {
        id: 'da1b2',
        type: 'dm',
        requestingShip: '~zod',
        timestamp: Date.now(),
      },
    ];
    const text = formatPendingList(approvals, ctx);
    expect(text).toContain('Zod (~zod)');
  });

  it('shows channel names for channel approvals', () => {
    const approvals: PendingApproval[] = [
      {
        id: 'cc3d4',
        type: 'channel',
        requestingShip: '~zod',
        channelNest: 'chat/~host/general',
        timestamp: Date.now(),
      },
    ];
    const text = formatPendingList(approvals, ctx);
    expect(text).toContain('General in Garden Club (chat/~host/general)');
  });

  it('shows group names for group approvals', () => {
    const approvals: PendingApproval[] = [
      {
        id: 'g5f6e',
        type: 'group',
        requestingShip: '~zod',
        groupFlag: '~host/cool-group',
        timestamp: Date.now(),
      },
    ];
    const text = formatPendingList(approvals, ctx);
    expect(text).toContain('Garden Club (~host/cool-group)');
  });

  it('includes slash command usage hint', () => {
    const approvals: PendingApproval[] = [
      {
        id: 'da1b2',
        type: 'dm',
        requestingShip: '~zod',
        timestamp: Date.now(),
      },
    ];
    const text = formatPendingList(approvals);
    expect(text).toContain('/allow');
    expect(text).toContain('/reject');
    expect(text).toContain('/ban');
  });

  it('filters out expired approvals', () => {
    const approvals: PendingApproval[] = [
      {
        id: 'da1b2',
        type: 'dm',
        requestingShip: '~zod',
        timestamp: Date.now() - APPROVAL_TTL_MS - 1,
      },
    ];
    const text = formatPendingList(approvals);
    expect(text).toBe('No pending approval requests.');
  });
});

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

describe('removePendingApproval', () => {
  it('removes by ID', () => {
    const approvals: PendingApproval[] = [
      { id: 'da1b2', type: 'dm', requestingShip: '~zod', timestamp: 1 },
      { id: 'cc3d4', type: 'channel', requestingShip: '~bus', timestamp: 2 },
    ];
    const result = removePendingApproval(approvals, 'da1b2');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('cc3d4');
  });
});

// ---------------------------------------------------------------------------
// Emoji Reaction Mapping
// ---------------------------------------------------------------------------

describe('emojiToApprovalAction', () => {
  it('maps thumbs up to approve', () => {
    expect(emojiToApprovalAction('👍')).toBe('approve');
  });

  it('maps thumbs down to deny', () => {
    expect(emojiToApprovalAction('👎')).toBe('deny');
  });

  it('maps stop sign to block', () => {
    expect(emojiToApprovalAction('🛑')).toBe('block');
  });

  it('returns undefined for unrecognized emoji', () => {
    expect(emojiToApprovalAction('❤️')).toBeUndefined();
    expect(emojiToApprovalAction('🎉')).toBeUndefined();
    expect(emojiToApprovalAction('')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Notification ID Normalization
// ---------------------------------------------------------------------------

describe('normalizeNotificationId', () => {
  it('strips ship prefix and dots', () => {
    expect(normalizeNotificationId('~zod/170.141.184.507')).toBe(
      '170141184507'
    );
  });

  it('strips dots from bare IDs (no ship prefix)', () => {
    expect(normalizeNotificationId('170.141.184.507')).toBe('170141184507');
  });

  it('handles IDs without dots', () => {
    expect(normalizeNotificationId('170141184507')).toBe('170141184507');
  });

  it('handles full writ-id format', () => {
    expect(normalizeNotificationId('~sampel-palnet/170.141.184.507.799')).toBe(
      '170141184507799'
    );
  });
});

describe('hasDuplicatePending', () => {
  const approvals: PendingApproval[] = [
    { id: 'da1b2', type: 'dm', requestingShip: '~zod', timestamp: 1 },
    {
      id: 'cc3d4',
      type: 'channel',
      requestingShip: '~bus',
      channelNest: 'chat/~host/general',
      timestamp: 2,
    },
  ];

  it('detects DM duplicates', () => {
    expect(hasDuplicatePending(approvals, 'dm', '~zod')).toBe(true);
    expect(hasDuplicatePending(approvals, 'dm', '~bus')).toBe(false);
  });

  it('detects channel duplicates by nest', () => {
    expect(
      hasDuplicatePending(approvals, 'channel', '~bus', 'chat/~host/general')
    ).toBe(true);
    expect(
      hasDuplicatePending(approvals, 'channel', '~bus', 'chat/~host/other')
    ).toBe(false);
  });
});
