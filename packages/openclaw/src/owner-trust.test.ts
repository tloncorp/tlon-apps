import { resolveCommandAuthorization } from 'openclaw/plugin-sdk/command-auth';
import { describe, expect, it } from 'vitest';

import {
  type MessageOrigin,
  channelMessageOrigin,
  channelPrivilegeWithheldReason,
  channelRevisionState,
  conversationKindOf,
  coreSenderId,
  isOwnerPrivilegeTrusted,
  ownerTrustSourceFor,
  resolveSenderRole,
} from './owner-trust.js';

const context = { ownerShip: '~zod', botShip: '~nec' };

describe('isOwnerPrivilegeTrusted', () => {
  it.each([
    ['DM with the owner', '~zod', 'create', true],
    ['DM with another ship', '~bus', 'create', false],
    [
      'new post in a channel the owner hosts',
      'chat/~zod/general',
      'create',
      true,
    ],
    [
      'new post in a channel the bot hosts',
      'chat/~nec/general',
      'create',
      true,
    ],
    [
      'new post in a channel another ship hosts',
      'chat/~bus/general',
      'create',
      false,
    ],
    ['new post in a heap the owner hosts', 'heap/~zod/links', 'create', true],
    ['edit in a channel the owner hosts', 'chat/~zod/general', 'edit', false],
    ['edit in a channel the bot hosts', 'chat/~nec/general', 'edit', false],
    [
      'edit in a channel another ship hosts',
      'chat/~bus/general',
      'edit',
      false,
    ],
    ['unparseable conversation', 'chat/general', 'create', false],
  ] as const)('%s → %s', (_label, conversation, origin, trusted) => {
    expect(
      isOwnerPrivilegeTrusted(
        ownerTrustSourceFor(conversation, origin),
        context
      )
    ).toBe(trusted);
  });

  it('trusts nothing without a configured owner', () => {
    const noOwner = { ownerShip: null, botShip: '~nec' };
    expect(
      isOwnerPrivilegeTrusted(ownerTrustSourceFor('~zod', 'create'), noOwner)
    ).toBe(false);
    expect(
      isOwnerPrivilegeTrusted(
        ownerTrustSourceFor('chat/~nec/x', 'create'),
        noOwner
      )
    ).toBe(false);
  });

  it('compares ships case- and sig-insensitively', () => {
    expect(
      isOwnerPrivilegeTrusted({ kind: 'dm', partnerShip: 'ZOD' }, context)
    ).toBe(true);
    expect(
      isOwnerPrivilegeTrusted(
        { kind: 'channel', hostShip: 'Zod', origin: 'create' },
        context
      )
    ).toBe(true);
  });
});

describe('resolveSenderRole', () => {
  it.each([
    ['owner in their DM', '~zod', '~zod', 'create', 'owner'],
    ['another ship in its DM', '~bus', '~bus', 'create', 'user'],
    [
      'owner post, owner-hosted',
      '~zod',
      'chat/~zod/general',
      'create',
      'owner',
    ],
    ['owner post, bot-hosted', '~zod', 'chat/~nec/general', 'create', 'owner'],
    [
      'owner post, foreign-hosted',
      '~zod',
      'chat/~bus/general',
      'create',
      'user',
    ],
    [
      'owner-attributed edit, bot-hosted',
      '~zod',
      'chat/~nec/general',
      'edit',
      'user',
    ],
    [
      'owner-attributed edit, owner-hosted',
      '~zod',
      'chat/~zod/general',
      'edit',
      'user',
    ],
    [
      'non-owner, foreign-hosted',
      '~bus',
      'chat/~bus/general',
      'create',
      'user',
    ],
    ['non-owner, owner-hosted', '~bus', 'chat/~zod/general', 'create', 'user'],
  ] as const)('%s → %s', (_label, sender, conversation, origin, role) => {
    expect(
      resolveSenderRole(
        sender,
        ownerTrustSourceFor(conversation, origin),
        context
      )
    ).toBe(role);
  });
});

describe('conversationKindOf', () => {
  it.each([
    ['~zod', 'dm'],
    ['~bus', 'dm'],
    ['chat/~zod/general', 'ownerHostedChannel'],
    ['chat/~nec/general', 'botHostedChannel'],
    ['chat/~bus/general', 'foreignHostedChannel'],
  ] as const)('%s → %s', (conversation, kind) => {
    expect(
      conversationKindOf(ownerTrustSourceFor(conversation, 'create'), context)
    ).toBe(kind);
  });
});

describe('channelRevisionState and channelPrivilegeWithheldReason', () => {
  it.each([
    [{ revision: '0' }, 'create'],
    [{ revision: '3' }, 'edit'],
    [{}, 'missing revision'],
    [null, 'missing revision'],
    [{ revision: '' }, 'missing revision'],
  ] as const)('%j → %s', (set, state) => {
    expect(channelRevisionState(set)).toBe(state);
  });

  it('names a foreign host, an edit or a missing revision', () => {
    expect(channelPrivilegeWithheldReason(false, 'create')).toBe(
      'host is neither the owner nor this bot'
    );
    expect(channelPrivilegeWithheldReason(true, 'edit')).toBe('edit');
    expect(channelPrivilegeWithheldReason(true, 'missing revision')).toBe(
      'missing revision'
    );
  });
});

describe('channelMessageOrigin', () => {
  it.each([
    [{ revision: '0' }, 'create'],
    [{ revision: 0 }, 'create'],
    [{ revision: '1' }, 'edit'],
    [{ revision: '12' }, 'edit'],
    [{}, 'edit'],
    [null, 'edit'],
    [undefined, 'edit'],
  ] as const)('%j → %s', (set, origin) => {
    expect(channelMessageOrigin(set)).toBe(origin);
  });
});

describe('coreSenderId', () => {
  const idFor = (sender: string, conversation: string, origin: MessageOrigin) =>
    coreSenderId(
      sender,
      resolveSenderRole(
        sender,
        ownerTrustSourceFor(conversation, origin),
        context
      ),
      conversation,
      context
    );

  it('keeps the bare ship for a privileged owner and for everyone else', () => {
    expect(idFor('~zod', '~zod', 'create')).toBe('~zod');
    expect(idFor('~zod', 'chat/~zod/general', 'create')).toBe('~zod');
    expect(idFor('~bus', 'chat/~bus/general', 'create')).toBe('~bus');
    expect(idFor('~bus', '~bus', 'create')).toBe('~bus');
  });

  it('qualifies an owner attribution without privilege by its conversation', () => {
    expect(idFor('~zod', 'chat/~bus/general', 'create')).toBe(
      '~zod@chat/~bus/general'
    );
    expect(idFor('~zod', 'chat/~nec/general', 'edit')).toBe(
      '~zod@chat/~nec/general'
    );
  });

  // Core matches SenderId against commands.ownerAllowFrom itself; SenderRole
  // does not reach that decision.
  const coreSenderIsOwner = (senderId: string) =>
    resolveCommandAuthorization({
      ctx: {
        Provider: 'tlon',
        Surface: 'tlon',
        SenderId: senderId,
        From: 'tlon:group:chat/~bus/general',
        To: 'tlon:~nec',
        ChatType: 'group',
        AccountId: 'default',
      },
      // Bare entry: the `tlon:` prefix form needs the channel plugin loaded.
      cfg: { commands: { ownerAllowFrom: ['~zod'] } },
      commandAuthorized: false,
    } as Parameters<typeof resolveCommandAuthorization>[0]).senderIsOwner;

  it('makes core see the owner only where owner privilege is trusted', () => {
    expect(
      coreSenderIsOwner(idFor('~zod', 'chat/~zod/general', 'create'))
    ).toBe(true);
    expect(coreSenderIsOwner(idFor('~zod', '~zod', 'create'))).toBe(true);
    expect(
      coreSenderIsOwner(idFor('~zod', 'chat/~bus/general', 'create'))
    ).toBe(false);
    expect(coreSenderIsOwner(idFor('~zod', 'chat/~nec/general', 'edit'))).toBe(
      false
    );
  });
});
