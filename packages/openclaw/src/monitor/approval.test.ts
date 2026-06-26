import { A2UI } from '@tloncorp/api';
import { describe, expect, it } from 'vitest';

import {
  APPROVAL_TTL_MS,
  type DisplayContext,
  type PendingApproval,
  buildApprovalA2UIBlob,
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
