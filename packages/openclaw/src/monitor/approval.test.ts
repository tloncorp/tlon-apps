import { A2UI } from '@tloncorp/api';
import { describe, expect, it, vi } from 'vitest';

import {
  APPROVAL_TTL_MS,
  type ApprovalQueueContext,
  type DisplayContext,
  type PendingApproval,
  RENOTIFY_COOLDOWN_MS,
  applyApprovalRequest,
  buildApprovalA2UIBlob,
  buildPendingApprovalsA2UIBlob,
  buildPendingApprovalsResponse,
  createPendingApproval,
  emojiToApprovalAction,
  findPendingApproval,
  formatApprovalConfirmation,
  formatApprovalRequestNotification,
  formatBlockedList,
  formatGroupLabel,
  formatPendingList,
  generateApprovalId,
  isExpired,
  mergeApprovalDeliveryState,
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

  it('stays under the a2ui component limit with the maximum of four fully-loaded approvals', () => {
    const approvals: PendingApproval[] = Array.from(
      { length: 4 },
      (_, index) => ({
        id: `c${index}ab`,
        type: 'channel' as const,
        requestingShip: `~ship${index}`,
        channelNest: 'chat/~host/general',
        messagePreview: `@bot request number ${index}`,
        timestamp: Date.now(),
        originalMessage: {
          messageId: `170.141.184.${600 + index}`,
          messageText: `@bot request number ${index}`,
          messageContent: [],
          timestamp: 1,
        },
      })
    );

    // makeA2UIBlob throws over the 50-component limit, which would drop the
    // card entirely — this must build and validate at the advertised max.
    const blob = buildPendingApprovalsA2UIBlob(approvals, ctx);
    expect(blob).toBeDefined();
    expect(A2UI.validateBlobEntry(blob)).toBe(true);
    expect(JSON.stringify(blob)).toContain('"id":"item3View"');
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

// ---------------------------------------------------------------------------
// applyApprovalRequest (queue semantics, fake clock)
// ---------------------------------------------------------------------------

describe('applyApprovalRequest', () => {
  const BASE_NOW = 1_000_000_000;

  function makeQueueHarness(options: { blocked?: boolean } = {}) {
    let now = BASE_NOW;
    let pending: PendingApproval[] = [];
    let idCounter = 0;
    const notify = vi.fn<
      (approval: PendingApproval) => Promise<string | undefined>
    >(async () => '~zod/170.141.184.507');
    const persist = vi.fn(async () => {});
    const isShipBlocked = vi.fn(async () => options.blocked ?? false);
    const ctx: ApprovalQueueContext = {
      getPending: () => pending,
      setPending: (next) => {
        pending = next;
      },
      isShipBlocked,
      notify,
      persist,
      now: () => now,
      log: vi.fn(),
    };
    const groupApproval = (
      overrides: Partial<PendingApproval> = {}
    ): PendingApproval => ({
      id: `g${(idCounter++).toString(16)}ab`,
      type: 'group',
      requestingShip: '~inviter',
      groupFlag: '~host/garden',
      groupTitle: 'Garden Club',
      timestamp: now,
      ...overrides,
    });
    return {
      ctx,
      notify,
      persist,
      isShipBlocked,
      groupApproval,
      getPending: () => pending,
      setPending: (next: PendingApproval[]) => {
        pending = next;
      },
      advance: (ms: number) => {
        now += ms;
      },
      now: () => now,
    };
  }

  const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  it('queues a new group approval, sends, stamps delivery, persists', async () => {
    const h = makeQueueHarness();

    await applyApprovalRequest(h.groupApproval(), h.ctx);

    expect(h.notify).toHaveBeenCalledTimes(1);
    expect(h.getPending()).toHaveLength(1);
    const stored = h.getPending()[0];
    expect(stored.notifyAttemptAt).toBe(h.now());
    expect(stored.notificationMessageId).toBe('170141184507');
    expect(h.persist).toHaveBeenCalledTimes(1);
  });

  it('dedups by flag alone and never re-sends once delivered', async () => {
    const h = makeQueueHarness();
    // Delivered approval from one inviter (notificationMessageId is the marker).
    h.setPending([
      h.groupApproval({
        requestingShip: '~first',
        notifyAttemptAt: h.now() - 5_000,
        notificationMessageId: '170141184507',
      }),
    ]);

    h.advance(RENOTIFY_COOLDOWN_MS * 2);
    await applyApprovalRequest(
      h.groupApproval({ requestingShip: '~second' }),
      h.ctx
    );

    // Same flag from a different inviter: no second record, no re-DM.
    expect(h.getPending()).toHaveLength(1);
    expect(h.getPending()[0].requestingShip).toBe('~first');
    expect(h.notify).not.toHaveBeenCalled();
    expect(h.persist).not.toHaveBeenCalled();
  });

  it('retries a failed send only after the cooldown, then stamps delivery', async () => {
    const h = makeQueueHarness();
    h.notify.mockResolvedValueOnce(undefined);

    // Failed first send: record persisted, attempt stamped, no marker.
    await applyApprovalRequest(h.groupApproval(), h.ctx);
    expect(h.getPending()).toHaveLength(1);
    expect(h.getPending()[0].notifyAttemptAt).toBe(h.now());
    expect(h.getPending()[0].notificationMessageId).toBeUndefined();
    expect(h.persist).toHaveBeenCalledTimes(1);

    // Inside the cooldown: suppressed, no state change.
    const attemptAt = h.now();
    h.advance(RENOTIFY_COOLDOWN_MS - 1_000);
    await applyApprovalRequest(h.groupApproval(), h.ctx);
    expect(h.notify).toHaveBeenCalledTimes(1);
    expect(h.getPending()[0].notifyAttemptAt).toBe(attemptAt);

    // Past the cooldown: one retry, delivery stamped.
    h.advance(2_000);
    await applyApprovalRequest(h.groupApproval(), h.ctx);
    expect(h.notify).toHaveBeenCalledTimes(2);
    const stored = h.getPending()[0];
    expect(stored.notifyAttemptAt).toBe(h.now());
    expect(stored.notificationMessageId).toBe('170141184507');
  });

  it('queues a fresh record after the 48h TTL prunes the old one (reminder without restart)', async () => {
    const h = makeQueueHarness();
    await applyApprovalRequest(h.groupApproval(), h.ctx);
    expect(h.notify).toHaveBeenCalledTimes(1);

    h.advance(APPROVAL_TTL_MS + 1);
    const fresh = h.groupApproval();
    await applyApprovalRequest(fresh, h.ctx);

    expect(h.notify).toHaveBeenCalledTimes(2);
    expect(h.getPending()).toHaveLength(1);
    expect(h.getPending()[0].id).toBe(fresh.id);
  });

  it('treats a junk persisted delivery marker as undelivered and retries', async () => {
    const h = makeQueueHarness();
    // Persisted JSON can round-trip a null/empty/non-string marker; suppressing
    // on it would silence the retry for the full 48h TTL.
    for (const bogus of [null, '', 12345]) {
      h.notify.mockClear();
      h.setPending([
        h.groupApproval({
          notifyAttemptAt: h.now() - RENOTIFY_COOLDOWN_MS - 1,
          notificationMessageId: bogus as unknown as string,
        }),
      ]);

      await applyApprovalRequest(h.groupApproval(), h.ctx);

      expect(h.notify).toHaveBeenCalledTimes(1);
      expect(h.getPending()[0].notificationMessageId).toBe('170141184507');
    }
  });

  it('treats a junk persisted attempt stamp as no attempt and retries now', async () => {
    const h = makeQueueHarness();
    // Values that arithmetic would read as "attempted in the future" and so
    // suppress the retry indefinitely.
    for (const bogus of [Infinity, '9999999999999']) {
      h.notify.mockClear();
      h.setPending([
        h.groupApproval({ notifyAttemptAt: bogus as unknown as number }),
      ]);

      await applyApprovalRequest(h.groupApproval(), h.ctx);

      expect(h.notify).toHaveBeenCalledTimes(1);
      expect(h.getPending()[0].notifyAttemptAt).toBe(h.now());
    }
  });

  it('consults the block list only when an action is imminent', async () => {
    const h = makeQueueHarness();
    // Delivered duplicate: a no-op observation must not scry the block list
    // (the 2-minute poll re-observes every pending invite).
    h.setPending([h.groupApproval({ notificationMessageId: '170141184507' })]);
    await applyApprovalRequest(h.groupApproval(), h.ctx);
    expect(h.isShipBlocked).not.toHaveBeenCalled();

    // Undelivered but inside the cooldown: still a no-op, still no scry.
    h.setPending([h.groupApproval({ notifyAttemptAt: h.now() })]);
    await applyApprovalRequest(h.groupApproval(), h.ctx);
    expect(h.isShipBlocked).not.toHaveBeenCalled();

    // Past the cooldown a send is imminent, so the check runs.
    h.advance(RENOTIFY_COOLDOWN_MS + 1);
    await applyApprovalRequest(h.groupApproval(), h.ctx);
    expect(h.isShipBlocked).toHaveBeenCalledTimes(1);
  });

  it('silently ignores requests from blocked ships', async () => {
    const h = makeQueueHarness({ blocked: true });

    await applyApprovalRequest(h.groupApproval(), h.ctx);

    expect(h.isShipBlocked).toHaveBeenCalled();
    expect(h.notify).not.toHaveBeenCalled();
    expect(h.getPending()).toHaveLength(0);
    expect(h.persist).not.toHaveBeenCalled();
  });

  it('keeps dm dedup/re-notify behavior unchanged (preview update + re-notify)', async () => {
    const h = makeQueueHarness();
    const first: PendingApproval = {
      id: 'da1b2',
      type: 'dm',
      requestingShip: '~ten',
      timestamp: h.now(),
      messagePreview: 'first message',
      originalMessage: {
        messageId: 'm1',
        messageText: 'first message',
        messageContent: [],
        timestamp: h.now(),
      },
    };
    const second: PendingApproval = {
      id: 'da2c3',
      type: 'dm',
      requestingShip: '~ten',
      timestamp: h.now(),
      messagePreview: 'second message',
      originalMessage: {
        messageId: 'm2',
        messageText: 'second message',
        messageContent: [],
        timestamp: h.now(),
      },
    };

    await applyApprovalRequest(first, h.ctx);
    await applyApprovalRequest(second, h.ctx);

    // One record, original ID preserved, content updated, re-notified.
    expect(h.getPending()).toHaveLength(1);
    const stored = h.getPending()[0];
    expect(stored.id).toBe('da1b2');
    expect(stored.messagePreview).toBe('second message');
    expect(stored.originalMessage?.messageId).toBe('m2');
    expect(h.notify).toHaveBeenCalledTimes(2);
    expect(h.persist).toHaveBeenCalledTimes(2);
  });

  it('keeps channel dedup nested: same ship in different nests queues separately', async () => {
    const h = makeQueueHarness();
    const channel = (id: string, nest: string): PendingApproval => ({
      id,
      type: 'channel',
      requestingShip: '~ten',
      channelNest: nest,
      timestamp: h.now(),
      messagePreview: 'hi',
      originalMessage: {
        messageId: id,
        messageText: 'hi',
        messageContent: [],
        timestamp: h.now(),
      },
    });

    await applyApprovalRequest(channel('ca111', 'chat/~host/a'), h.ctx);
    await applyApprovalRequest(channel('ca222', 'chat/~host/b'), h.ctx);
    await applyApprovalRequest(channel('ca333', 'chat/~host/a'), h.ctx);

    expect(h.getPending().map((a) => a.id)).toEqual(['ca111', 'ca222']);
    expect(h.notify).toHaveBeenCalledTimes(3);
  });

  it('does not lose the approval when the pending list is replaced during a delayed notify', async () => {
    const h = makeQueueHarness();
    let resolveNotify!: (value: string | undefined) => void;
    h.notify.mockImplementation(
      () =>
        new Promise<string | undefined>((resolve) => {
          resolveNotify = resolve;
        })
    );

    const approval = h.groupApproval();
    const applied = applyApprovalRequest(approval, h.ctx);
    await flush();
    expect(h.getPending()).toHaveLength(1);

    // The settings subscription replaces the list wholesale mid-notify.
    h.setPending([]);
    resolveNotify('~zod/170.141.184.507');
    await applied;

    expect(h.getPending()).toHaveLength(1);
    const stored = h.getPending()[0];
    expect(stored.id).toBe(approval.id);
    expect(stored.notificationMessageId).toBe('170141184507');
    expect(h.persist).toHaveBeenCalledTimes(1);
  });

  it('stamps the live record when a retry notify races a list replacement', async () => {
    const h = makeQueueHarness();
    const undelivered = h.groupApproval({
      notifyAttemptAt: h.now() - RENOTIFY_COOLDOWN_MS - 1,
    });
    h.setPending([undelivered]);
    let resolveNotify!: (value: string | undefined) => void;
    h.notify.mockImplementation(
      () =>
        new Promise<string | undefined>((resolve) => {
          resolveNotify = resolve;
        })
    );

    const applied = applyApprovalRequest(h.groupApproval(), h.ctx);
    await flush();

    // The settings echo replaces the list with a fresh deserialization of the
    // same record, detaching the object the retry is holding.
    const replaced = h.groupApproval({ id: undelivered.id });
    h.setPending([replaced]);
    resolveNotify('~zod/170.141.184.507');
    await applied;

    expect(h.getPending()).toEqual([replaced]);
    expect(replaced.notificationMessageId).toBe('170141184507');
    expect(replaced.notifyAttemptAt).toBe(h.now());
    expect(h.persist).toHaveBeenCalledTimes(1);
  });

  it('keeps the cooldown when a failed retry races a replacement carrying a stale stamp', async () => {
    const h = makeQueueHarness();
    const staleStamp = h.now() - RENOTIFY_COOLDOWN_MS - 1;
    const undelivered = h.groupApproval({ notifyAttemptAt: staleStamp });
    h.setPending([undelivered]);
    let resolveNotify!: (value: string | undefined) => void;
    h.notify.mockImplementation(
      () =>
        new Promise<string | undefined>((resolve) => {
          resolveNotify = resolve;
        })
    );

    const attemptAt = h.now();
    const applied = applyApprovalRequest(h.groupApproval(), h.ctx);
    await flush();

    // The replacement still carries the stale persisted stamp, and the send
    // fails: the live record must adopt the newer attempt so the next poll
    // stays inside the cooldown instead of retrying every 2 minutes.
    const replaced = h.groupApproval({
      id: undelivered.id,
      notifyAttemptAt: staleStamp,
    });
    h.setPending([replaced]);
    resolveNotify(undefined);
    await applied;

    expect(replaced.notifyAttemptAt).toBe(attemptAt);
    expect(replaced.notificationMessageId).toBeUndefined();
  });

  it('does not resurrect a retried approval removed during the notify', async () => {
    const h = makeQueueHarness();
    h.setPending([
      h.groupApproval({ notifyAttemptAt: h.now() - RENOTIFY_COOLDOWN_MS - 1 }),
    ]);
    let resolveNotify!: (value: string | undefined) => void;
    h.notify.mockImplementation(
      () =>
        new Promise<string | undefined>((resolve) => {
          resolveNotify = resolve;
        })
    );

    const applied = applyApprovalRequest(h.groupApproval(), h.ctx);
    await flush();

    // Removed mid-notify (owner acted, or the record expired): the retry has
    // nothing live to stamp and must not write the detached copy back.
    h.setPending([]);
    resolveNotify('~zod/170.141.184.507');
    await applied;

    expect(h.getPending()).toEqual([]);
    expect(h.persist).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Bounded group labels (AC3 host-in-surface)
// ---------------------------------------------------------------------------

describe('group surfaces show host flag alongside title', () => {
  it('includes the flag in the approval card Group context line', () => {
    const approval = buildApprovalA2UIBlob({
      id: 'g5f6e',
      type: 'group',
      requestingShip: '~robin-dasler',
      groupFlag: '~robin-dasler/garden-club',
      groupTitle: 'Garden Club',
      timestamp: 1,
    });

    expect(A2UI.validateBlobEntry(approval)).toBe(true);
    expect(JSON.stringify(approval)).toContain(
      'Group: Garden Club (~robin-dasler/garden-club)'
    );
  });

  it('includes the group label in the plain-text notification', () => {
    expect(
      formatApprovalRequestNotification({
        type: 'group',
        requestingShip: '~robin-dasler',
        groupFlag: '~robin-dasler/garden-club',
        groupTitle: 'Garden Club',
      })
    ).toBe(
      'Group invite request from ~robin-dasler for Garden Club (~robin-dasler/garden-club)'
    );
  });

  it('bounds oversized titles and flags on the /pending card and text fallback', () => {
    const oversized: PendingApproval = {
      id: 'g5f6e',
      type: 'group',
      requestingShip: '~robin-dasler',
      groupFlag: `~robin-dasler/${'g'.repeat(5_000)}`,
      groupTitle: 'x'.repeat(5_000),
      timestamp: Date.now(),
    };

    // makeA2UIBlob throws when a text node exceeds the a2ui cap; a bounded
    // label keeps the card valid instead of degrading to text-only.
    const blob = buildPendingApprovalsA2UIBlob([oversized]);
    expect(blob).toBeDefined();
    expect(A2UI.validateBlobEntry(blob)).toBe(true);
    const cardText = JSON.stringify(blob);
    expect(cardText).toContain('Group: ');
    expect(cardText).toContain('~robin-dasler/');

    const text = formatPendingList([oversized]);
    expect(text).toContain('~robin-dasler/');
    expect(text.length).toBeLessThan(1_000);
  });
});

// ---------------------------------------------------------------------------
// mergeApprovalDeliveryState (settings-snapshot replacement guard)
// ---------------------------------------------------------------------------

describe('mergeApprovalDeliveryState', () => {
  const group = (
    overrides: Partial<PendingApproval> = {}
  ): PendingApproval => ({
    id: 'g5f6e',
    type: 'group',
    requestingShip: '~inviter',
    groupFlag: '~host/garden',
    timestamp: 1_000,
    ...overrides,
  });

  it('carries delivery state onto an echo that lacks it', () => {
    const merged = mergeApprovalDeliveryState(
      [group()],
      [
        group({
          notificationMessageId: '170141184507',
          notifyAttemptAt: 4_000,
        }),
      ]
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].notificationMessageId).toBe('170141184507');
    expect(merged[0].notifyAttemptAt).toBe(4_000);
  });

  it('never downgrades markers the incoming record already carries', () => {
    const merged = mergeApprovalDeliveryState(
      [
        group({
          notificationMessageId: '170141184999',
          notifyAttemptAt: 9_000,
        }),
      ],
      [
        group({
          notificationMessageId: '170141184507',
          notifyAttemptAt: 4_000,
        }),
      ]
    );

    expect(merged[0].notificationMessageId).toBe('170141184999');
    expect(merged[0].notifyAttemptAt).toBe(9_000);
  });

  it('does not resurrect a record the snapshot removed', () => {
    const merged = mergeApprovalDeliveryState(
      [],
      [group({ notificationMessageId: '170141184507' })]
    );

    expect(merged).toEqual([]);
  });
});
