import {
  AnyColumn,
  Column,
  SQLWrapper,
  Subquery,
  Table,
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  max,
  min,
  not,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';

import {
  ACTIVITY_SOURCE_PAGESIZE,
  ChannelInit,
  getCurrentUserId,
} from '../api';
import { parseGroupId } from '../api/apiUtils';
import { createDevLogger } from '../debug';
import * as domain from '../domain';
import { appendContactIdToReplies, getCompositeGroups } from '../logic';
import {
  SourceActivityEvents,
  interleaveActivityEvents,
  toSourceActivityEvents,
} from '../logic/activity';
import { Session } from '../store';
import { Rank } from '../urbit';
import { processBatchOperation } from './dbUtils';
import { createDmChannelsForNewContacts } from './modelBuilders';
import {
  QueryCtx,
  createReadQuery,
  createWriteQuery,
  withTransactionCtx,
} from './query';
import {
  activityEventContactGroups as $activityEventContactGroups,
  activityEvents as $activityEvents,
  attestations as $attestations,
  baseUnreads as $baseUnreads,
  channelReaders as $channelReaders,
  channelUnreads as $channelUnreads,
  channelWriters as $channelWriters,
  channels as $channels,
  chatMemberGroupRoles as $chatMemberGroupRoles,
  chatMembers as $chatMembers,
  contactAttestations as $contactAttestations,
  contactGroups as $contactGroups,
  contacts as $contacts,
  groupFlaggedPosts as $groupFlaggedPosts,
  groupJoinRequests as $groupJoinRequests,
  groupMemberBans as $groupMemberBans,
  groupMemberInvites as $groupMemberInvites,
  groupNavSectionChannels as $groupNavSectionChannels,
  groupNavSections as $groupNavSections,
  groupRankBans as $groupRankBans,
  groupRoles as $groupRoles,
  groupUnreads as $groupUnreads,
  groups as $groups,
  pins as $pins,
  postReactions as $postReactions,
  postWindows as $postWindows,
  posts as $posts,
  settings as $settings,
  systemContactSentInvites as $systemContactSentInvites,
  systemContacts as $systemContacts,
  threadUnreads as $threadUnreads,
  volumeSettings as $volumeSettings,
  BASE_UNREADS_SINGLETON_KEY,
  SETTINGS_SINGLETON_KEY,
} from './schema';
import {
  ActivityBucket,
  ActivityEvent,
  Attestation,
  BaseUnread,
  Channel,
  ChannelUnread,
  Chat,
  ClientMeta,
  Contact,
  ContactAttestation,
  Group,
  GroupNavSection,
  GroupRole,
  GroupUnread,
  Pin,
  PinType,
  Post,
  PostWindow,
  Reaction,
  ReplyMeta,
  Settings,
  SystemContact,
  SystemContactSentInvite,
  TableName,
  ThreadUnreadState,
  VolumeSettings,
} from './types';

const logger = createDevLogger('queries', false);

const GROUP_META_COLUMNS = {
  id: true,
  title: true,
  description: true,
  iconImage: true,
  iconImageColor: true,
  coverImage: true,
  coverImageColor: true,
};

export interface GetGroupsOptions {
  includeUnjoined?: boolean;
  includeUnreads?: boolean;
  includeLastPost?: boolean;
}

export const insertSettings = createWriteQuery(
  'insertSettings',
  async (settings: Partial<Settings>, ctx: QueryCtx) => {
    return ctx.db
      .insert($settings)
      .values({ ...settings, id: SETTINGS_SINGLETON_KEY })
      .onConflictDoUpdate({
        target: $settings.id,
        set: settings,
      });
  },
  ['settings']
);

export const getSettings = createReadQuery(
  'getSettings',
  async (ctx: QueryCtx) => {
    return ctx.db.query.settings.findFirst({
      where(fields) {
        return eq(fields.id, SETTINGS_SINGLETON_KEY);
      },
    });
  },
  ['settings']
);

export const getGroupPreviews = createReadQuery(
  'getGroupPreviews',
  async (groupIds: string[], ctx: QueryCtx) => {
    if (groupIds.length === 0) return [];
    return ctx.db.query.groups.findMany({
      where: inArray($groups.id, groupIds),
    });
  },
  ['groups']
);

export const getJoinedGroupsCount = createReadQuery(
  'getJoinedGroupCount',
  async (ctx: QueryCtx) => {
    const result = await ctx.db
      .select({ count: count() })
      .from($groups)
      .where(eq($groups.currentUserIsMember, true));

    return result[0]?.count ?? 0;
  },
  ['groups']
);

// TODO: inefficient, should optimize
export const getGroupsWithMemberThreshold = createReadQuery(
  'getGroupsWithMemberThreshold',
  async (threshold: number, ctx: QueryCtx) => {
    const allJoinedWithMembers = await ctx.db.query.groups.findMany({
      where: eq($groups.currentUserIsMember, true),
      with: {
        members: true,
      },
    });

    return allJoinedWithMembers.filter((g) => g.members.length <= threshold);
  },
  ['groups']
);

export const getGroups = createReadQuery(
  'getGroups',
  async (
    { includeUnjoined, includeLastPost, includeUnreads }: GetGroupsOptions,
    ctx: QueryCtx
  ): Promise<Group[]> => {
    const unreadCounts = ctx.db
      .select({
        groupId: $channels.groupId,
        count: count().as('count'),
      })
      .from($channels)
      .rightJoin($channelUnreads, eq($channels.id, $channelUnreads.channelId))
      .groupBy($channels.groupId)
      .having(gt($channelUnreads.count, 0))
      .as('unreadCounts');
    const query = ctx.db
      .select({
        ...getTableColumns($groups),
        ...(includeUnreads ? { unreadCount: unreadCounts.count } : undefined),
        ...(includeLastPost
          ? { lastPost: getTableColumns($posts) }
          : undefined),
      })
      .from($groups)
      .where(() =>
        includeUnjoined ? undefined : eq($groups.currentUserIsMember, true)
      );
    if (includeLastPost) {
      query.leftJoin($posts, eq($groups.lastPostId, $posts.id));
    }
    if (includeUnreads) {
      query.leftJoin(unreadCounts, eq($groups.id, unreadCounts.groupId));
    }
    return query;
  },
  ({ includeLastPost, includeUnreads }: GetGroupsOptions): TableName[] => [
    'groups',
    ...(includeLastPost ? (['posts'] as TableName[]) : []),
    ...(includeUnreads ? (['channelUnreads'] as TableName[]) : []),
  ]
);

export const getUnjoinedGroupChannels = createReadQuery(
  'getUnjoinedGroupChannels',
  async (groupId: string, ctx: QueryCtx) => {
    const currentUserId = getCurrentUserId();
    logger.log(
      'getUnjoinedGroupChannels: checking for user',
      currentUserId,
      'in group',
      groupId
    );

    const group = await ctx.db.query.groups.findFirst({
      where: eq($groups.id, groupId),
      with: {
        roles: {
          with: {
            members: true,
          },
        },
      },
    });

    if (!group) return [];

    const userRolesForGroup =
      group.roles
        ?.filter((role) =>
          role.members?.map((m) => m.contactId).includes(currentUserId)
        )
        .map((role) => role.id) ?? [];

    logger.log('getUnjoinedGroupChannels: user roles', userRolesForGroup);

    const allUnjoined = await ctx.db.query.channels.findMany({
      where: and(
        eq($channels.groupId, groupId),
        eq($channels.currentUserIsMember, false)
      ),
      with: {
        readerRoles: true,
      },
    });

    logger.log(
      'getUnjoinedGroupChannels: found unjoined channels',
      allUnjoined.map((c) => ({
        id: c.id,
        readerRoles: c.readerRoles,
      }))
    );

    return allUnjoined.filter((channel) => {
      const isOpenChannel = channel.readerRoles?.length === 0;
      const isClosedButCanRead = channel.readerRoles
        ?.map((r) => r.roleId)
        .some((r) => userRolesForGroup.includes(r));

      const canRead = isOpenChannel || isClosedButCanRead;
      logger.log(
        'getUnjoinedGroupChannels: channel',
        channel.id,
        'isOpen:',
        isOpenChannel,
        'hasPermission:',
        isClosedButCanRead,
        'canRead:',
        canRead
      );
      return canRead;
    });
  },
  ['channels', 'groups']
);

export const getAnalyticsDigest = createReadQuery(
  'getAnalyticsDigest',
  async (ctx: QueryCtx): Promise<domain.AnalyticsDigest> => {
    const numContacts = await ctx.db
      .select({ count: count() })
      .from($contacts)
      .where(eq($contacts.isContact, true));

    const numSystemContacts = await ctx.db
      .select({ count: count() })
      .from($systemContacts);

    const groups = await ctx.db.query.groups.findMany({
      where: eq($groups.currentUserIsMember, true),
      with: {
        channels: true,
      },
    });
    const numGroups = groups.length;
    const numGroupchats = groups.filter((g) => g.channels.length === 1).length;
    const numGroupsHosted = groups.filter((g) => g.currentUserIsHost).length;

    const channels = await ctx.db.query.channels.findMany({
      where: eq($channels.currentUserIsMember, true),
    });

    const numChannels = channels.length;
    const numDms = channels.filter((c) => c.type === 'dm').length;
    const numLegacyGroupDms = channels.filter(
      (c) => c.type === 'groupDm'
    ).length;
    const numGalleries = channels.filter((c) => c.type === 'gallery').length;
    const numNotebooks = channels.filter((c) => c.type === 'notebook').length;

    return {
      numContacts: numContacts[0]?.count ?? 0,
      numSystemContacts: numSystemContacts[0]?.count ?? 0,
      numGroups,
      numGroupchats,
      numGroupsHosted,
      numChannels,
      numDms,
      numLegacyGroupDms,
      numGalleries,
      numNotebooks,
    };
  },
  []
);

export const insertSystemContacts = createWriteQuery(
  'insertSystemContacts',
  async (params: { systemContacts: SystemContact[] }, ctx: QueryCtx) => {
    const { systemContacts } = params;
    if (!systemContacts.length) return;

    // Process in batches of 200
    const batchSize = 200;
    for (let i = 0; i < systemContacts.length; i += batchSize) {
      const batch = systemContacts.slice(i, i + batchSize);
      if (!batch.length) continue;
      try {
        await ctx.db
          .insert($systemContacts)
          .values(batch)
          .onConflictDoUpdate({
            target: [$systemContacts.id],
            set: conflictUpdateSetAll($systemContacts, ['contactId']),
          });
        logger.trackEvent(domain.AnalyticsEvent.DebugSystemContacts, {
          context: 'inserted system contacts batch',
          count: batch.length,
          startIndex: i,
        });
      } catch (e) {
        logger.trackEvent(domain.AnalyticsEvent.ErrorSystemContacts, {
          context: 'failed to insert system contacts',
          count: batch.length,
          totalNumContacts: systemContacts.length,
        });
      }
    }
  },
  ['systemContacts', 'systemContactSentInvites', 'contacts']
);

function generateNicknameUpdates(
  matches: [string, string][],
  systemContacts: SystemContact[]
): { contactId: string; nicknamePart: string }[] {
  const nicknameUpdates: { contactId: string; nicknamePart: string }[] = [];

  for (const [phoneNumber, contactId] of matches) {
    const matchingSystemContact = systemContacts.find(
      (sc) => sc.phoneNumber === phoneNumber
    );

    if (
      matchingSystemContact &&
      (matchingSystemContact.firstName || matchingSystemContact.lastName)
    ) {
      const nicknamePart =
        `${matchingSystemContact.firstName || ''} ${matchingSystemContact.lastName || ''}`.trim();

      if (nicknamePart) {
        nicknameUpdates.push({ contactId, nicknamePart });
      }
    }
  }

  return nicknameUpdates;
}

async function updateContactNicknames(
  nicknameUpdates: { contactId: string; nicknamePart: string }[],
  txCtx: QueryCtx,
  batchSize: number
): Promise<void> {
  await processBatchOperation(
    nicknameUpdates,
    batchSize,
    async (batch) => {
      return Promise.all(
        batch.map(({ contactId, nicknamePart }) =>
          txCtx.db
            .update($contacts)
            .set({ customNickname: nicknamePart })
            .where(eq($contacts.id, contactId))
        )
      );
    },
    'Error updating contact nicknames'
  );
}

export async function updateSystemContactIds(
  matches: [string, string][],
  txCtx: QueryCtx,
  batchSize: number
): Promise<void> {
  const contactIdUpdates = matches.map(([phoneNumber, contactId]) => ({
    phoneNumber,
    contactId,
  }));

  await processBatchOperation(
    contactIdUpdates,
    batchSize,
    async (batch) => {
      return Promise.all(
        batch.map(({ phoneNumber, contactId }) =>
          txCtx.db
            .update($systemContacts)
            .set({ contactId })
            .where(eq($systemContacts.phoneNumber, phoneNumber))
        )
      );
    },
    'Error updating system contact contactId'
  );
}

export const linkSystemContacts = createWriteQuery(
  'linkSystemContacts',
  async (params: { matches: [string, string][] }, ctx: QueryCtx) => {
    if (!params.matches.length) return;
    const { matches } = params;

    const systemContactPhoneNumbers = matches.map((m) => m[0]);

    const contactIds = matches.map((m) => m[1]);

    const systemContacts = await getSystemContacts(ctx);

    return withTransactionCtx(ctx, async (txCtx) => {
      const [existingContacts, linkedSystemContacts] = await Promise.all([
        txCtx.db.query.contacts.findMany({
          where: and(
            inArray($contacts.id, contactIds),
            eq($contacts.isContact, true)
          ),
        }),
        txCtx.db.query.systemContacts.findMany({
          where: and(
            inArray($systemContacts.phoneNumber, systemContactPhoneNumbers),
            isNotNull($systemContacts.contactId)
          ),
        }),
      ]);

      // determine which contacts and phone links are new
      const existingContactIds = new Set(existingContacts.map((c) => c.id));
      const alreadyLinkedPhoneNumbers = new Set(
        linkedSystemContacts.map((sc) => sc.phoneNumber)
      );

      const newContactMatches = matches.filter(
        ([phoneNumber, contactId]) =>
          !existingContactIds.has(contactId) ||
          !alreadyLinkedPhoneNumbers.has(phoneNumber)
      );

      const batchSize = 200;

      // generate and process nickname updates
      const nicknameUpdates = generateNicknameUpdates(matches, systemContacts);
      await updateContactNicknames(nicknameUpdates, txCtx, batchSize);

      // update system contact IDs
      await updateSystemContactIds(matches, txCtx, batchSize);

      // create channels for new contacts
      const newChannels = createDmChannelsForNewContacts(newContactMatches);

      // we use insertChannelsInternal so that we can create the channels within
      // the transaction
      await insertChannelsInternal(newChannels, txCtx);
    });
  },
  ['systemContacts', 'systemContactSentInvites', 'contacts']
);

export const insertSystemContactSentInvites = createWriteQuery(
  'insertSystemContactSentInvites',
  async (params: { sentInvites: SystemContactSentInvite[] }, ctx: QueryCtx) => {
    const { sentInvites } = params;
    if (!sentInvites.length) return;
    await ctx.db
      .insert($systemContactSentInvites)
      .values(sentInvites)
      .onConflictDoUpdate({
        target: [
          $systemContactSentInvites.systemContactId,
          $systemContactSentInvites.invitedTo,
        ],
        set: conflictUpdateSetAll($systemContactSentInvites),
      });
  },
  ['systemContacts', 'systemContactSentInvites', 'contacts']
);

export const getSystemContacts = createReadQuery(
  'getSystemContacts',
  async (ctx: QueryCtx): Promise<SystemContact[]> => {
    try {
      logger.log('getSystemContacts: getting system contacts');
      const result = await ctx.db.query.systemContacts.findMany({
        with: { sentInvites: true },
      });
      logger.log('getSystemContacts: got system contacts', result);
      return result;
    } catch (e) {
      console.log(`Error getting system contacts`, e);
      throw e;
    }
  },
  ['systemContacts', 'systemContactSentInvites']
);

export const getSystemContactsBatchByContactId = createReadQuery(
  'getSystemContactsBatchByContactId',
  async (contactIds: string[], ctx: QueryCtx): Promise<SystemContact[]> => {
    if (!contactIds.length) return [];
    try {
      const result = await ctx.db.query.systemContacts.findMany({
        where: inArray($systemContacts.contactId, contactIds),
        with: { sentInvites: true },
      });
      return result;
    } catch (e) {
      console.log(`Error getting system contacts`, e);
      throw e;
    }
  },
  ['systemContacts', 'systemContactSentInvites']
);

export const getUninvitedSystemContactsShortlist = createReadQuery(
  'getUninvitedSystemContactsShortlist',
  async (ctx: QueryCtx): Promise<SystemContact[]> => {
    try {
      const result = await ctx.db.query.systemContacts.findMany({
        with: { sentInvites: true },
      });

      const uninvitedContacts = result.filter(
        (contact) => contact.sentInvites?.length === 0
      );

      return uninvitedContacts.slice(0, 10);
    } catch (e) {
      console.log(`Error getting uninvited system contacts`, e);
      throw e;
    }
  },
  ['systemContacts', 'systemContactSentInvites']
);

export const insertCurrentUserAttestations = createWriteQuery(
  'insertCurrentUserAttestations',
  async ({ attestations }: { attestations: Attestation[] }, ctx: QueryCtx) => {
    const currentUserId = getCurrentUserId();

    await withTransactionCtx(ctx, async (txCtx) => {
      if (attestations.length === 0) {
        await txCtx.db
          .delete($attestations)
          .where(and(eq($attestations.contactId, currentUserId)));
      } else {
        await txCtx.db.delete($attestations).where(
          and(
            eq($attestations.contactId, currentUserId),
            not(
              inArray(
                $attestations.id,
                attestations.map((v) => v.id)
              )
            )
          )
        );
      }

      const contactAttestations = attestations.map((v) => ({
        contactId: v.contactId,
        attestationId: v.id,
      }));

      if (contactAttestations.length > 0) {
        await txCtx.db
          .insert($attestations)
          .values(attestations)
          .onConflictDoUpdate({
            target: [$attestations.id],
            set: conflictUpdateSetAll($attestations),
          });

        await txCtx.db
          .insert($contactAttestations)
          .values(contactAttestations)
          .onConflictDoNothing();
      }
    });
  },
  ['attestations', 'contacts']
);

export const deleteAttestation = createWriteQuery(
  'deleteAttestation',
  async (
    { type, value }: { type: Attestation['type']; value: string },
    ctx: QueryCtx
  ) => {
    return ctx.db
      .delete($attestations)
      .where(and(eq($attestations.type, type), eq($attestations.value, value)));
  },
  ['attestations', 'contacts']
);

export const getAttestations = createReadQuery(
  'getAttestations',
  async (ctx: QueryCtx) => {
    return ctx.db.query.attestations.findMany();
  },
  ['attestations']
);

export const getAttestation = createReadQuery(
  'getAttestation',
  async ({ attestation }: { attestation: Attestation }, ctx: QueryCtx) => {
    return ctx.db.query.attestations.findFirst({
      where: eq($attestations.id, attestation.id),
    });
  },
  ['attestations']
);

export const updateAttestation = createWriteQuery(
  'updateAttestations',
  async ({ attestation }: { attestation: Attestation }, ctx: QueryCtx) => {
    return ctx.db
      .update($attestations)
      .set(attestation)
      .where(eq($attestations.id, attestation.id));
  },
  ['attestations']
);

export const getUserAttestations = createReadQuery(
  'getUserAttestations',
  async ({ userId }: { userId: string }, ctx: QueryCtx) => {
    return ctx.db.query.attestations.findMany({
      where: eq($attestations.contactId, userId),
    });
  },
  ['attestations']
);

export const getPins = createReadQuery(
  'getPins',
  async (ctx: QueryCtx): Promise<Pin[]> => {
    return ctx.db.query.pins.findMany();
  },
  ['pins']
);

export const getAllChannels = createReadQuery(
  'getAllChannels',
  async (ctx: QueryCtx) => {
    return ctx.db.query.channels.findMany();
  },
  ['channels']
);

export const getChannelsForPredictiveSync = createReadQuery(
  'getChannelsWithUncachedGap',
  async (
    opts: { session: Session; limit?: number },
    ctx: QueryCtx
  ): Promise<Channel[]> => {
    const { session } = opts;
    return await ctx.db.query.channels.findMany({
      // where channel can fetch newer posts (i.e. has not cached newest posts)
      where: not(
        // logic ported from `hasChannelCachedNewestPosts`
        // https://github.com/tloncorp/tlon-apps/blob/b967030abb33522964b7ca925c4c599bee489ae7/packages/shared/src/store/sync.ts#L1400
        and(
          isNotNull($channels.syncedAt),
          or(
            gte($channels.syncedAt, session.startTime ?? 0),
            and(
              isNotNull($channels.lastPostAt),
              gt($channels.syncedAt, $channels.lastPostAt)
            )
          )
        )!
      ),

      orderBy: [desc($channels.lastViewedAt), desc($channels.lastPostAt)],
      limit: opts.limit,
    });
  },
  ['channels']
);

export const getMentionCandidates = createReadQuery(
  'getMentionCandidates',
  async (
    {
      chatId,
      limit = 4,
      query,
    }: { chatId: string; limit?: number; query: string },
    ctx: QueryCtx
  ) => {
    if (!(query = query.trim())) return [];

    const idSearchTerm = `~${query.toLowerCase()}%`;
    const searchTerm = `${query.toLowerCase()}%`;

    const $candidates = ctx.db
      .select({
        id: sql<string>`COALESCE(${$contacts.id}, ${$chatMembers.contactId})`.as(
          'id'
        ),
        nickname: $contacts.nickname,
        avatarImage: $contacts.avatarImage,
        bio: $contacts.bio,
        status: $contacts.status,
        color: $contacts.color,
        membershipType: $chatMembers.membershipType,
        joinedAt: $chatMembers.joinedAt,
        isBlocked: $contacts.isBlocked,
        // Priority: 1 = group members, 2 = other contacts, 3 = other group members
        priority: sql<number>`
          CASE 
            WHEN ${$chatMembers.chatId} = ${chatId} THEN 1
            WHEN ${$contacts.isContact} = true THEN 2
            ELSE 3
          END
        `.as('priority'),
      })
      .from($contacts)
      .fullJoin(
        $chatMembers,
        and(
          eq($chatMembers.contactId, $contacts.id),
          eq($chatMembers.chatId, chatId)
        )
      )
      .where(
        and(
          // Match the search term against id or nickname
          or(
            sql`${$chatMembers.contactId} LIKE ${idSearchTerm}`,
            sql`${$contacts.id} LIKE ${idSearchTerm}`,
            sql`COALESCE(${$contacts.nickname}, '') LIKE ${searchTerm}`
          ),
          or(isNull($contacts.isBlocked), eq($contacts.isBlocked, false))
        )
      )
      .as('candidates');

    return (
      ctx.db
        .select({
          id: $candidates.id,
          nickname: $candidates.nickname,
          avatarImage: $candidates.avatarImage,
          bio: $candidates.bio,
          status: $candidates.status,
          color: $candidates.color,
          membershipType: $candidates.membershipType,
          joinedAt: $candidates.joinedAt,
          isBlocked: $candidates.isBlocked,
          priority: min($candidates.priority)
            .mapWith((p) => parseInt(p))
            .as('priority'),
        })
        .from($candidates)
        // This call to sql is only necessary because of a drizzle type inference issue
        .groupBy(sql`${$candidates.id}`)
        .limit(limit)
    );
  },
  ['chatMembers', 'contacts']
);

export const getChats = createReadQuery(
  'getChats',
  async (
    ctx: QueryCtx
  ): Promise<{ pinned: Chat[]; pending: Chat[]; unpinned: Chat[] }> => {
    const groups = await ctx.db.query.groups.findMany({
      where: or(
        eq($groups.currentUserIsMember, true),
        eq($groups.isNew, true),
        eq($groups.haveInvite, true),
        eq($groups.haveRequestedInvite, true),
        isNotNull($groups.joinStatus)
      ),
      with: {
        volumeSettings: true,
        unread: true,
        channels: {
          orderBy: [desc($channels.lastPostAt)],
          with: {
            lastPost: true,
          },
        },
        // Just need the first 3 members for possible title generation purposes
        members: {
          limit: 3,
          orderBy: [asc($chatMembers.joinedAt)],
          with: {
            contact: true,
          },
        },
        pin: true,
        lastPost: true,
      },
    });

    const channels = await ctx.db.query.channels.findMany({
      with: {
        group: true,
        volumeSettings: true,
        unread: true,
        members: {
          with: {
            contact: true,
          },
        },
        pin: true,
        lastPost: true,
      },
    });

    const groupChats: Chat[] = groups.map((g) => ({
      id: g.id,
      type: 'group',
      pin: g.pin,
      timestamp: g.unread?.updatedAt ?? g.lastPostAt ?? 0,
      volumeSettings: g.volumeSettings,
      unreadCount: g.unread?.count ?? 0,
      group: g,
      isPending:
        g.haveInvite === true ||
        !!g.joinStatus ||
        g.haveRequestedInvite ||
        false,
    }));

    const channelChats: Chat[] = channels.map((c) => ({
      id: c.id,
      type: 'channel',
      channel: c,
      pin: c.pin,
      volumeSettings: c.volumeSettings,
      unreadCount: c.unread?.count ?? 0,
      timestamp: c.unread?.updatedAt ?? c.lastPostAt ?? 0,
      isPending: !!c.isDmInvite,
    }));

    const { pinnedChats, pendingChats, otherChats } = [
      ...channelChats,
      ...groupChats,
    ].reduce(
      (acc, chat) => {
        if (chat.pin) {
          acc.pinnedChats.push(chat);
        } else if (chat.isPending) {
          acc.pendingChats.push(chat);
        } else {
          acc.otherChats.push(chat);
        }
        return acc;
      },
      {
        pinnedChats: [],
        pendingChats: [],
        otherChats: [],
      } as Record<string, Chat[]>
    );

    return {
      pinned: pinnedChats.sort(
        (a, b) => (a.pin?.index ?? 0) - (b.pin?.index ?? 0)
      ),
      pending: pendingChats,
      unpinned: otherChats.sort((a, b) => b.timestamp - a.timestamp),
    };
  },
  [
    'groups',
    'channels',
    'posts',
    'contacts',
    'channelUnreads',
    'groupUnreads',
    'threadUnreads',
    'volumeSettings',
  ]
);

export const insertGroups = createWriteQuery(
  'insertGroups',
  async (
    { groups, overWrite = true }: { groups: Group[]; overWrite?: boolean },
    ctx: QueryCtx
  ) => {
    return withTransactionCtx(ctx, async (txCtx) => {
      if (groups.length === 0) return;
      logger.log(
        'insertGroups: attempting to insert',
        groups.map((g) => g.id)
      );
      const currentGroups = await txCtx.db.query.groups.findMany();
      logger.log(
        'insertGroups: existing groups',
        currentGroups.map((g) => g.id)
      );
      for (const group of groups) {
        logger.log('insertGroups: inserting group', group.id);
        if (overWrite) {
          await txCtx.db
            .insert($groups)
            .values(group)
            .onConflictDoUpdate({
              target: $groups.id,
              set: conflictUpdateSet(
                $groups.iconImage,
                $groups.coverImage,
                $groups.title,
                $groups.description,
                $groups.privacy,
                $groups.joinStatus,
                $groups.currentUserIsMember,
                $groups.haveInvite,
                $groups.haveRequestedInvite
              ),
            });
        } else {
          await txCtx.db.insert($groups).values(group).onConflictDoNothing();
        }
        if (group.channels?.length) {
          logger.log(
            'insertGroups: inserting channels for group',
            group.id,
            group.channels.map((c) => ({
              id: c.id,
              readerRoles: c.readerRoles,
              group: c.groupId,
            }))
          );

          // First insert/update the channels
          await txCtx.db
            .insert($channels)
            .values(group.channels)
            .onConflictDoUpdate({
              target: [$channels.id],
              set: conflictUpdateSet(
                $channels.iconImage,
                $channels.coverImage,
                $channels.title,
                $channels.description,
                $channels.addedToGroupAt,
                $channels.type,
                $channels.isPendingChannel,
                $channels.contentConfiguration
              ),
            });

          const channels = await txCtx.db.query.channels.findMany({
            where: eq($channels.groupId, group.id),
          });
          const toDelete = channels
            .map((c) => c.id)
            .filter(
              (id) => group.channels?.find((c) => c.id === id) === undefined
            );
          logger.log('insertGroups: deleting channels', toDelete);
          await txCtx.db
            .delete($channels)
            .where(inArray($channels.id, toDelete));

          // Then handle reader roles separately
          for (const channel of group.channels) {
            if (channel.readerRoles) {
              // Clear existing reader roles
              await txCtx.db
                .delete($channelReaders)
                .where(eq($channelReaders.channelId, channel.id));

              if (channel.readerRoles.length > 0) {
                // Insert new reader roles
                await txCtx.db
                  .insert($channelReaders)
                  .values(channel.readerRoles);
              }
            }
          }

          logger.log('insertGroups: finished inserting channels');
        }
        if (group.flaggedPosts?.length) {
          logger.log(
            'insertGroups: inserting flagged posts',
            group.flaggedPosts
          );
          await txCtx.db
            .insert($groupFlaggedPosts)
            .values(group.flaggedPosts)
            .onConflictDoNothing();
        }
        if (group.navSections?.length) {
          logger.log('insertGroups: inserting nav sections', group.navSections);
          await txCtx.db
            .insert($groupNavSections)
            .values(
              group.navSections.map((s) => ({
                id: s.id,
                sectionId: s.sectionId,
                groupId: group.id,
                title: s.title,
                description: s.description,
                sectionIndex: s.sectionIndex,
              }))
            )
            .onConflictDoUpdate({
              target: $groupNavSections.id,
              set: conflictUpdateSet(
                $groupNavSections.iconImage,
                $groupNavSections.coverImage,
                $groupNavSections.title,
                $groupNavSections.description
              ),
            });

          const navSectionChannels = group.navSections.flatMap(
            (s) => s.channels
          );
          if (navSectionChannels.length) {
            await txCtx.db
              .insert($groupNavSectionChannels)
              .values(
                navSectionChannels.map((s) => ({
                  channelIndex: s?.channelIndex,
                  groupNavSectionId: s?.groupNavSectionId,
                  channelId: s?.channelId,
                }))
              )
              .onConflictDoNothing();
          }
        }
        if (group.roles?.length) {
          logger.log('insertGroups: inserting roles', group.roles);
          await txCtx.db
            .insert($groupRoles)
            .values(group.roles)
            .onConflictDoUpdate({
              target: [$groupRoles.groupId, $groupRoles.id],
              set: conflictUpdateSet(
                $groupRoles.groupId,
                $groupRoles.iconImage,
                $groupRoles.coverImage,
                $groupRoles.title,
                $groupRoles.description
              ),
            });
        }
        if (group.members?.length) {
          logger.log('insertGroups: inserting members', group.members);
          await txCtx.db
            .insert($chatMembers)
            .values(group.members)
            .onConflictDoUpdate({
              target: [$chatMembers.chatId, $chatMembers.contactId],
              set: conflictUpdateSetAll($chatMembers),
            });

          const validRoleNames = group.roles?.map((r) => r.id);
          const memberRoles = group.members.flatMap((m) => {
            return (m.roles ?? []).flatMap((r) => {
              // TODO: This is here because I've seen at least one instance (in
              // Galen's TD group) where a member is assigned a role that doesn't
              // exist in the group's cabals. Should figure out if this is expected
              // behavior if we should try retain the role.
              if (!validRoleNames?.includes(r.roleId)) {
                return [];
              }
              return {
                groupId: group.id,
                contactId: m.contactId,
                roleId: r.roleId,
              };
            });
          });
          if (memberRoles.length) {
            logger.log('insertGroups: inserting member roles', memberRoles);
            await txCtx.db
              .insert($chatMemberGroupRoles)
              .values(memberRoles)
              .onConflictDoNothing();
          }
        }

        if (group.bannedMembers?.length) {
          logger.log('insertGroups: inserting bans', group.bannedMembers);
          await txCtx.db
            .insert($groupMemberBans)
            .values(
              group.bannedMembers.map((m) => ({
                groupId: group.id,
                contactId: m.contactId,
              }))
            )
            .onConflictDoNothing();
        }

        if (group.joinRequests?.length) {
          logger.log(
            'insertGroups: inserting join requests',
            group.joinRequests
          );
          await txCtx.db
            .insert($groupJoinRequests)
            .values(
              group.joinRequests.map((m) => ({
                groupId: group.id,
                contactId: m.contactId,
              }))
            )
            .onConflictDoNothing();
        }
      }
      await setLastPosts(null, txCtx);
    });
  },
  [
    'groups',
    'groupRoles',
    'contacts',
    'chatMembers',
    'chatMemberGroupRoles',
    'channels',
    'pins',
  ]
);

export const insertGroupPreviews = createWriteQuery(
  'insert group previews',
  ({ groups }: { groups: Group[] }, ctx: QueryCtx) => {
    return withTransactionCtx(ctx, async (txCtx) => {
      if (groups.length === 0) return;
      for (const group of groups) {
        await txCtx.db
          .insert($groups)
          .values(group)
          .onConflictDoUpdate({
            target: $groups.id,
            set: conflictUpdateSet(
              $groups.iconImage,
              $groups.coverImage,
              $groups.title,
              $groups.description,
              $groups.privacy
            ),
          });
      }
    });
  },
  ['groups']
);

export const updateGroup = createWriteQuery(
  'updateGroup',
  async (group: Partial<Group> & { id: string }, ctx: QueryCtx) => {
    return ctx.db.update($groups).set(group).where(eq($groups.id, group.id));
  },
  ['groups', 'channels', 'groupNavSections', 'groupNavSectionChannels']
);

export const deleteGroup = createWriteQuery(
  'deleteGroup',
  async (groupId: string, ctx: QueryCtx) => {
    return ctx.db.delete($groups).where(eq($groups.id, groupId));
  },
  ['groups', 'channels']
);

export const insertUnjoinedGroups = createWriteQuery(
  'insertUnjoinedGroups',
  async (groups: Group[], ctx: QueryCtx) => {
    if (groups.length === 0) return;
    logger.log('insertUnjoinedGroups', groups.length);

    return withTransactionCtx(ctx, async (txCtx) => {
      if (groups.length === 0) return;

      // ensure we never delete metadata if we get a partial for some reason
      // during the join process
      const existingUnjoined = await getUnjoinedGroupMeta(txCtx);
      const compositeUnjoined = getCompositeGroups(groups, existingUnjoined);

      await txCtx.db
        .insert($groups)
        .values(compositeUnjoined)
        .onConflictDoUpdate({
          target: $groups.id,
          setWhere: eq($groups.currentUserIsMember, false),
          set: conflictUpdateSetAll($groups),
        });
    });
  },
  ['groups']
);

export const getUnjoinedGroupMeta = createReadQuery(
  'getUnjoinedGroupMeta',
  async (ctx: QueryCtx) => {
    return ctx.db.query.groups.findMany({
      where: eq($groups.currentUserIsMember, false),
      columns: GROUP_META_COLUMNS,
    });
  },
  ['groups']
);

export const getUnjoinedGroups = createReadQuery(
  'getUnjoinedGroups',
  async (ctx: QueryCtx) => {
    return ctx.db.query.groups.findMany({
      where: eq($groups.currentUserIsMember, false),
    });
  },
  ['groups']
);

export const insertFlaggedPosts = createWriteQuery(
  'insertFlaggedPosts',
  async (
    content: {
      groupId: string;
      postId: string;
      channelId: string;
      flaggedByContactId: string;
    }[],
    ctx: QueryCtx
  ) => {
    return ctx.db
      .insert($groupFlaggedPosts)
      .values(content)
      .onConflictDoNothing();
  },
  ['groupFlaggedPosts']
);

export const getFlaggedPosts = createReadQuery(
  'getFlaggedPosts',
  async (groupId: string, ctx: QueryCtx) => {
    return ctx.db.query.groupFlaggedPosts.findMany({
      where: eq($groupFlaggedPosts.groupId, groupId),
    });
  },
  ['groupFlaggedPosts']
);

export const insertChannelPerms = createWriteQuery(
  'insertChannelPerms',
  async (channelsInit: Omit<ChannelInit, 'order'>[], ctx: QueryCtx) => {
    const writers = channelsInit.flatMap((chanInit) =>
      (chanInit.writers || []).map((writer) => ({
        channelId: chanInit.channelId,
        roleId: writer,
      }))
    );

    const readers = channelsInit.flatMap((chanInit) =>
      (chanInit.readers || []).map((reader) => ({
        channelId: chanInit.channelId,
        roleId: reader,
      }))
    );

    // clear out existing readers for these channels
    await ctx.db.delete($channelReaders).where(
      inArray(
        $channelReaders.channelId,
        channelsInit.map((c) => c.channelId)
      )
    );

    // insert any new readers
    if (readers.length > 0) {
      await ctx.db
        .insert($channelReaders)
        .values(readers)
        .onConflictDoUpdate({
          target: [$channelReaders.channelId, $channelReaders.roleId],
          set: conflictUpdateSetAll($channelReaders),
        });
    }

    // clear out existing writers for these channels
    await ctx.db.delete($channelWriters).where(
      inArray(
        $channelWriters.channelId,
        channelsInit.map((c) => c.channelId)
      )
    );

    // insert any new writers
    if (writers.length > 0) {
      await ctx.db
        .insert($channelWriters)
        .values(writers)
        .onConflictDoUpdate({
          target: [$channelWriters.channelId, $channelWriters.roleId],
          set: conflictUpdateSetAll($channelWriters),
        });
    }
  },
  ['channelWriters', 'channelReaders', 'channels']
);

export const insertChannelOrder = createWriteQuery(
  'insertChannelOrder',
  async (
    channelsInit: Pick<ChannelInit, 'channelId' | 'order'>[],
    ctx: QueryCtx
  ) => {
    await withTransactionCtx(ctx, async (txc) => {
      await Promise.all(
        channelsInit.map(async (chanInit) => {
          if (!chanInit.order) return;

          await txc.db
            .update($channels)
            .set({ order: chanInit.order })
            .where(eq($channels.id, chanInit.channelId));
        })
      );
    });
  },
  ['channels']
);

export const getThreadPosts = createReadQuery(
  'getThreadPosts',
  ({ parentId }: { parentId: string }, ctx: QueryCtx) => {
    return ctx.db.query.posts.findMany({
      where: eq($posts.parentId, parentId),
      with: {
        author: true,
        reactions: {
          with: {
            contact: true,
          },
        },
      },
      orderBy: [desc($posts.receivedAt)],
    });
  },
  ['posts']
);

export const getThreadUnreadState = createReadQuery(
  'getThreadUnreadState',
  ({ parentId }: { parentId: string }, ctx: QueryCtx) => {
    if (!parentId) return Promise.resolve(null);

    return ctx.db.query.threadUnreads.findFirst({
      where: eq($threadUnreads.threadId, parentId),
    });
  },
  ['threadUnreads']
);

export const getAllGroupRoles = createReadQuery(
  'getGroupRoles',
  async (ctx: QueryCtx) => {
    return ctx.db.query.groupRoles.findMany();
  },
  ['groupRoles']
);

export const getChatMember = createReadQuery(
  'getChatMember',
  async (
    { chatId, contactId }: { chatId: string; contactId: string },
    ctx: QueryCtx
  ) => {
    return ctx.db.query.chatMembers
      .findFirst({
        where: and(
          eq($chatMembers.chatId, chatId),
          eq($chatMembers.contactId, contactId)
        ),
        with: {
          roles: true,
        },
      })
      .then(returnNullIfUndefined);
  },
  ['chatMembers', 'chatMemberGroupRoles']
);

export const addChatMembers = createWriteQuery(
  'addChatMembers',
  async (
    {
      chatId,
      contactIds,
      type,
      joinStatus,
    }: {
      chatId: string;
      contactIds: string[];
      type: 'group' | 'channel';
      joinStatus: 'invited' | 'joined';
    },
    ctx: QueryCtx
  ) => {
    return withTransactionCtx(ctx, (txCtx) => {
      return txCtx.db
        .insert($chatMembers)
        .values(
          contactIds.map((contactId) => ({
            chatId,
            contactId,
            membershipType: type,
            status: joinStatus,
          }))
        )
        .onConflictDoUpdate({
          target: [$chatMembers.chatId, $chatMembers.contactId],
          set: {
            status: joinStatus as 'invited' | 'joined',
          },
        });
    });
  },
  ['chatMembers', 'groups']
);

export const addGroupInvites = createWriteQuery(
  'addGroupInvites',
  async (invites: { groupId: string; contactIds: string[] }, ctx: QueryCtx) => {
    if (invites.contactIds.length === 0) return;
    return ctx.db
      .insert($groupMemberInvites)
      .values(
        invites.contactIds.map((contactId) => ({
          groupId: invites.groupId,
          contactId,
        }))
      )
      .onConflictDoNothing();
  },
  ['groupMemberInvites']
);

export const getGroupInvites = createReadQuery(
  'getGroupInvites',
  async (groupId: string, ctx: QueryCtx) => {
    return ctx.db.query.groupMemberInvites.findMany({
      where: eq($groupMemberInvites.groupId, groupId),
    });
  },
  ['groupMemberInvites']
);

export const deleteGroupInvites = createWriteQuery(
  'deleteGroupInvites',
  async (invites: { groupId: string; contactIds: string[] }, ctx: QueryCtx) => {
    return ctx.db
      .delete($groupMemberInvites)
      .where(
        and(
          eq($groupMemberInvites.groupId, invites.groupId),
          inArray($groupMemberInvites.contactId, invites.contactIds)
        )
      );
  },
  ['groupMemberInvites']
);

export const addGroupJoinRequests = createWriteQuery(
  'addGroupJoinRequest',
  async (
    requests: { groupId: string; contactIds: string[] },
    ctx: QueryCtx
  ) => {
    if (requests.contactIds.length === 0) return;
    return ctx.db
      .insert($groupJoinRequests)
      .values(
        requests.contactIds.map((contactId) => ({
          groupId: requests.groupId,
          contactId,
        }))
      )
      .onConflictDoNothing();
  },
  ['groupJoinRequests']
);

export const getGroupJoinRequests = createReadQuery(
  'getGroupJoinRequests',
  async (groupId: string, ctx: QueryCtx) => {
    return ctx.db.query.groupJoinRequests.findMany({
      where: eq($groupJoinRequests.groupId, groupId),
    });
  },
  ['groupJoinRequests']
);

export const deleteGroupJoinRequests = createWriteQuery(
  'deleteGroupJoinRequests',
  async (
    requests: { groupId: string; contactIds: string[] },
    ctx: QueryCtx
  ) => {
    if (requests.contactIds.length === 0) return;
    return ctx.db
      .delete($groupJoinRequests)
      .where(
        and(
          eq($groupJoinRequests.groupId, requests.groupId),
          inArray($groupJoinRequests.contactId, requests.contactIds)
        )
      );
  },
  ['groupJoinRequests']
);

export const addGroupMemberBans = createWriteQuery(
  'addGroupMemberBans',
  async (bans: { groupId: string; contactIds: string[] }, ctx: QueryCtx) => {
    if (bans.contactIds.length === 0) return;
    return ctx.db
      .insert($groupMemberBans)
      .values(
        bans.contactIds.map((contactId) => ({
          groupId: bans.groupId,
          contactId,
        }))
      )
      .onConflictDoNothing();
  },
  ['groupMemberBans']
);

export const getGroupMemberBans = createReadQuery(
  'getGroupMemberBans',
  async (groupId: string, ctx: QueryCtx) => {
    return ctx.db.query.groupMemberBans.findMany({
      where: eq($groupMemberBans.groupId, groupId),
    });
  },
  ['groupMemberBans']
);

export const deleteGroupMemberBans = createWriteQuery(
  'deleteGroupMemberBans',
  async (bans: { groupId: string; contactIds: string[] }, ctx: QueryCtx) => {
    if (bans.contactIds.length === 0) return;
    return ctx.db
      .delete($groupMemberBans)
      .where(
        and(
          eq($groupMemberBans.groupId, bans.groupId),
          inArray($groupMemberBans.contactId, bans.contactIds)
        )
      );
  },
  ['groupMemberBans']
);

export const addGroupRankBans = createWriteQuery(
  'addGroupRankBans',
  async (bans: { groupId: string; ranks: Rank[] }, ctx: QueryCtx) => {
    if (bans.ranks.length === 0) return;
    return ctx.db
      .insert($groupRankBans)
      .values(
        bans.ranks.map((rank) => ({
          groupId: bans.groupId,
          rankId: rank,
        }))
      )
      .onConflictDoNothing();
  },
  ['groupRankBans']
);

export const getGroupRankBans = createReadQuery(
  'getGroupRankBans',
  async (groupId: string, ctx: QueryCtx) => {
    return ctx.db.query.groupRankBans.findMany({
      where: eq($groupRankBans.groupId, groupId),
    });
  },
  ['groupRankBans']
);

export const deleteGroupRankBans = createWriteQuery(
  'deleteGroupRankBans',
  async (bans: { groupId: string; ranks: Rank[] }, ctx: QueryCtx) => {
    if (bans.ranks.length === 0) return;
    return ctx.db
      .delete($groupRankBans)
      .where(
        and(
          eq($groupRankBans.groupId, bans.groupId),
          inArray($groupRankBans.rankId, bans.ranks)
        )
      );
  },
  ['groupRankBans']
);

export const addRole = createWriteQuery(
  'addRole',
  async (role: GroupRole, ctx: QueryCtx) => {
    return ctx.db
      .insert($groupRoles)
      .values(role)
      .onConflictDoUpdate({
        target: $groupRoles.id,
        set: conflictUpdateSetAll($groupRoles),
      });
  },
  ['groupRoles']
);

export const deleteRole = createWriteQuery(
  'deleteRole',
  async (
    { roleId, groupId }: { roleId: string; groupId: string },
    ctx: QueryCtx
  ) => {
    return ctx.db
      .delete($groupRoles)
      .where(and(eq($groupRoles.id, roleId), eq($groupRoles.groupId, groupId)));
  },
  ['groupRoles']
);

export const updateRole = createWriteQuery(
  'updateRole',
  async (
    role: Partial<GroupRole> & { id: string; groupId: string },
    ctx: QueryCtx
  ) => {
    return ctx.db
      .update($groupRoles)
      .set(role)
      .where(
        and(eq($groupRoles.groupId, role.groupId), eq($groupRoles.id, role.id))
      );
  },
  ['groupRoles']
);

export const addChatMembersToRoles = createWriteQuery(
  'addChatMembersToRoles',
  async (
    {
      groupId,
      contactIds,
      roleIds,
    }: {
      groupId: string;
      contactIds: string[];
      roleIds: string[];
    },
    ctx: QueryCtx
  ) => {
    return ctx.db.insert($chatMemberGroupRoles).values(
      contactIds.flatMap((contactId) =>
        roleIds.map((roleId) => ({
          groupId,
          contactId,
          roleId,
        }))
      )
    );
  },
  ['chatMembers', 'chatMemberGroupRoles']
);

export const removeChatMembersFromRoles = createWriteQuery(
  'removeChatMembersFromRoles',
  async (
    {
      groupId,
      contactIds,
      roleIds,
    }: {
      groupId: string;
      contactIds: string[];
      roleIds: string[];
    },
    ctx: QueryCtx
  ) => {
    if (contactIds.length === 0 || roleIds.length === 0) return;
    return ctx.db
      .delete($chatMemberGroupRoles)
      .where(
        and(
          eq($chatMemberGroupRoles.groupId, groupId),
          inArray($chatMemberGroupRoles.contactId, contactIds),
          inArray($chatMemberGroupRoles.roleId, roleIds)
        )
      );
  },
  ['chatMemberGroupRoles']
);

export const removeChatMembers = createWriteQuery(
  'removeChatMembers',
  async (
    { chatId, contactIds }: { chatId: string; contactIds: string[] },
    ctx: QueryCtx
  ) => {
    if (contactIds.length === 0) return;
    return ctx.db
      .delete($chatMembers)
      .where(
        and(
          eq($chatMembers.chatId, chatId),
          inArray($chatMembers.contactId, contactIds)
        )
      );
  },
  ['chatMembers', 'groups']
);

export const getUnreadsCountWithoutMuted = createReadQuery(
  'getUnreadsCountWithoutMuted',
  async ({ type }: { type?: ChannelUnread['type'] }, ctx: QueryCtx) => {
    const result = await ctx.db
      .select({ count: count() })
      .from($channelUnreads)
      .where(() =>
        and(
          $channelUnreads.notify,
          gt($channelUnreads.count, 0),
          type ? eq($channelUnreads.type, type) : undefined
        )
      );
    return result[0]?.count ?? 0;
  },
  ['channelUnreads']
);

export interface GetUnreadsOptions {
  orderBy?: 'updatedAt';
  includeFullyRead?: boolean;
  type?: ChannelUnread['type'];
}

export const getUnreads = createReadQuery(
  'getUnreads',
  async (
    { orderBy = 'updatedAt', includeFullyRead = true, type }: GetUnreadsOptions,
    ctx: QueryCtx
  ) => {
    return ctx.db.query.channelUnreads.findMany({
      where: and(
        type ? eq($channelUnreads.type, type) : undefined,
        includeFullyRead ? undefined : gt($channelUnreads.count, 0)
      ),
      orderBy:
        orderBy === 'updatedAt' ? desc($channelUnreads.updatedAt) : undefined,
    });
  },
  ['channelUnreads']
);

export type ChannelVolume = {
  channelId: string;
  isMuted?: boolean;
  isNoisy?: boolean;
};

export const setVolumes = createWriteQuery(
  'setVolumes',
  async (
    {
      volumes,
      deleteOthers,
    }: { volumes: VolumeSettings[]; deleteOthers?: boolean },
    ctx: QueryCtx
  ) => {
    if (!volumes.length) return;
    await ctx.db
      .insert($volumeSettings)
      .values(volumes)
      .onConflictDoUpdate({
        target: $volumeSettings.itemId,
        set: conflictUpdateSetAll($volumeSettings),
      });

    if (deleteOthers) {
      const ids = volumes.map((v) => v.itemId);
      await ctx.db
        .delete($volumeSettings)
        .where(not(inArray($volumeSettings.itemId, ids)));
    }
  },
  ['volumeSettings']
);

export const removeVolumeLevels = createWriteQuery(
  'removeVolumeLevel',
  async ({ itemIds }: { itemIds: string[] }, ctx: QueryCtx) => {
    return ctx.db
      .delete($volumeSettings)
      .where(inArray($volumeSettings.itemId, itemIds));
  },
  ['volumeSettings']
);

export const getVolumeSetting = createReadQuery(
  'getVolume',
  (itemId: string, ctx: QueryCtx) => {
    return ctx.db.query.volumeSettings.findFirst({
      where: eq($volumeSettings.itemId, itemId),
    });
  },
  ['volumeSettings']
);

export const getGroupVolumeSetting = createReadQuery(
  'getGroupVolumeSetting',
  async ({ groupId }: { groupId: string }, ctx: QueryCtx) => {
    const groupSetting = await ctx.db.query.volumeSettings.findFirst({
      where: and(
        eq($volumeSettings.itemId, groupId),
        eq($volumeSettings.itemType, 'group')
      ),
    });

    // if we have a group level, return it
    if (groupSetting) {
      return groupSetting.level;
    }

    // otherwise, fallback to base
    const baseSetting = await ctx.db.query.volumeSettings.findFirst({
      where: and(eq($volumeSettings.itemType, 'base')),
    });
    return baseSetting?.level ?? 'medium';
  },
  ['volumeSettings']
);

export const getChannelVolumeSetting = createReadQuery(
  'getChannelVolumeSetting',
  async ({ channelId }: { channelId: string }, ctx: QueryCtx) => {
    const channelSetting = await ctx.db.query.volumeSettings.findFirst({
      where: and(
        eq($volumeSettings.itemId, channelId),
        eq($volumeSettings.itemType, 'channel')
      ),
    });

    // if we have a channel level, return it
    if (channelSetting) {
      return channelSetting.level;
    }

    // if it's a group channel, check the group volume
    // TODO: right now, this is only called for dm channels

    // otherwise, fallback to base
    const baseSetting = await ctx.db.query.volumeSettings.findFirst({
      where: and(eq($volumeSettings.itemType, 'base')),
    });
    return baseSetting?.level ?? 'medium';
  },
  ['volumeSettings']
);

export const getVolumeExceptions = createReadQuery(
  'getVolumeExceptions',
  async (ctx: QueryCtx) => {
    const base = await ctx.db.query.volumeSettings.findFirst({
      where: eq($volumeSettings.itemType, 'base'),
    });

    const exceptions = await ctx.db.query.volumeSettings.findMany({
      where: not(eq($volumeSettings.level, base?.level || 'default')),
    });

    const groupIds = [];
    const channelIds = [];
    for (const exception of exceptions) {
      if (exception.itemType === 'group') {
        groupIds.push(exception.itemId);
      }
      if (exception.itemType === 'channel') {
        channelIds.push(exception.itemId);
      }
    }

    let channels: Channel[] = [];
    if (channelIds.length) {
      channels = await ctx.db.query.channels.findMany({
        where: inArray($channels.id, channelIds),
        with: {
          group: true,
          volumeSettings: true,
        },
      });
    }

    let groups: Group[] = [];
    if (groupIds.length) {
      groups = await ctx.db.query.groups.findMany({
        where: inArray($groups.id, groupIds),
        with: {
          volumeSettings: true,
        },
      });
    }

    return { channels, groups };
  },
  ['volumeSettings']
);

export const clearVolumeSetting = createWriteQuery(
  'clearVolumeSettings',
  (itemId: string, ctx: QueryCtx) => {
    return ctx.db
      .delete($volumeSettings)
      .where(eq($volumeSettings.itemId, itemId));
  },
  ['volumeSettings']
);

export const getChannelUnread = createReadQuery(
  'getChannelUnread',
  async ({ channelId }: { channelId: string }, ctx: QueryCtx) => {
    if (!channelId) return Promise.resolve(null);
    return ctx.db.query.channelUnreads.findFirst({
      where: and(eq($channelUnreads.channelId, channelId)),
    });
  },
  ['channelUnreads']
);

export const getGroupUnread = createReadQuery(
  'getGroupUnread',
  async ({ groupId }: { groupId: string }, ctx: QueryCtx) => {
    if (!groupId) return Promise.resolve(null);
    return ctx.db.query.groupUnreads.findFirst({
      where: and(eq($groupUnreads.groupId, groupId)),
    });
  },
  ['groupUnreads']
);

export const getBaseUnread = createReadQuery(
  'getBaseUnread',
  async (ctx: QueryCtx) => {
    return ctx.db.query.baseUnreads.findFirst({
      where: eq($baseUnreads.id, BASE_UNREADS_SINGLETON_KEY),
    });
  },
  ['baseUnreads']
);

export const getThreadActivity = createReadQuery(
  'getThreadActivity',
  async (
    { channelId, postId }: { channelId: string; postId: string },
    ctx: QueryCtx
  ) => {
    return ctx.db.query.threadUnreads.findFirst({
      where: and(
        eq($threadUnreads.channelId, channelId),
        eq($threadUnreads.threadId, postId)
      ),
    });
  },
  ['channelUnreads', 'threadUnreads']
);

export const getChannel = createReadQuery(
  'getChannel',
  async (
    {
      id,
      includeMembers,
      includeWriters,
    }: { id: string; includeMembers?: boolean; includeWriters?: boolean },
    ctx: QueryCtx
  ) => {
    return ctx.db.query.channels
      .findFirst({
        where: eq($channels.id, id),
        with: {
          ...(includeMembers ? { members: { with: { contact: true } } } : {}),
          ...(includeWriters ? { writerRoles: true } : {}),
        },
      })
      .then(returnNullIfUndefined);
  },
  ['channels']
);

export const getAllMultiDms = createReadQuery(
  'getAllMultiDms',
  async (ctx: QueryCtx) => {
    return ctx.db.query.channels.findMany({
      where: eq($channels.type, 'groupDm'),
      with: {
        members: true,
      },
    });
  },
  []
);

export const getAllSingleDms = createReadQuery(
  'getAllSingleDms',
  async (ctx: QueryCtx) => {
    return ctx.db.query.channels.findMany({
      where: eq($channels.type, 'dm'),
      with: {
        members: true,
      },
    });
  },
  []
);

export const getChannelWithRelations = createReadQuery(
  'getChannelWithRelations',
  async ({ id }: { id: string }, ctx: QueryCtx): Promise<Channel | null> => {
    const result = await ctx.db.query.channels.findFirst({
      where: eq($channels.id, id),
      with: {
        lastPost: true,
        members: {
          with: {
            contact: true,
          },
        },
        volumeSettings: true,
        pin: true,
        unread: true,
        group: true,
        contact: true,
        writerRoles: {
          with: {
            role: true,
          },
        },
        readerRoles: {
          with: {
            role: true,
          },
        },
      },
    });
    return returnNullIfUndefined(result);
  },
  [
    'channels',
    'volumeSettings',
    'pins',
    'groups',
    'contacts',
    'channelUnreads',
    'channelWriters',
    'channelReaders',
  ]
);

async function insertChannelsInternal(channels: Channel[], ctx: QueryCtx) {
  if (channels.length === 0) {
    return;
  }

  logger.log(
    'insertChannelsInternal',
    channels.length,
    channels.map((c) => c.id)
  );

  await ctx.db
    .insert($channels)
    .values(channels)
    .onConflictDoUpdate({
      target: $channels.id,
      set: conflictUpdateSetAll($channels, [
        'lastPostId',
        'lastPostAt',
        'currentUserIsMember',
      ]),
    });

  for (const channel of channels) {
    logger.log('insertChannels: members', channel.id, channel.members);
    if (channel.members && channel.members.length > 0) {
      await ctx.db
        .delete($chatMembers)
        .where(eq($chatMembers.chatId, channel.id));
      await ctx.db
        .insert($chatMembers)
        .values(channel.members)
        .onConflictDoNothing();
    }
  }
  await setLastPosts(null, ctx);
}

export const insertChannels = createWriteQuery(
  'insertChannels',
  async (channels: Channel[], ctx: QueryCtx) => {
    if (channels.length === 0) {
      return;
    }

    logger.log(
      'insertChannels',
      channels.length,
      channels.map((c) => c.id),
      'skipTransaction'
    );

    return withTransactionCtx(ctx, async (txCtx) => {
      await insertChannelsInternal(channels, txCtx);
    });
  },
  ['channels']
);

export const updateChannel = createWriteQuery(
  'updateChannel',
  async (update: Partial<Channel> & { id: string }, ctx: QueryCtx) => {
    logger.log('updateChannel', update.id, update);

    return withTransactionCtx(ctx, async (txCtx) => {
      if (update.writerRoles || update.readerRoles) {
        let writers = update.writerRoles?.map((role) => role.roleId as string);
        let readers = update.readerRoles?.map((role) => role.roleId as string);

        // If we only have one type of roles, get the existing roles for the other type
        if (update.writerRoles && !update.readerRoles) {
          // Only updating writers, preserve existing readers
          const existingReaders = await txCtx.db.query.channelReaders.findMany({
            where: eq($channelReaders.channelId, update.id),
          });
          readers = existingReaders.map((r) => r.roleId);
        } else if (update.readerRoles && !update.writerRoles) {
          // Only updating readers, preserve existing writers
          const existingWriters = await txCtx.db.query.channelWriters.findMany({
            where: eq($channelWriters.channelId, update.id),
          });
          writers = existingWriters.map((w) => w.roleId);
        }

        await insertChannelPerms(
          [
            {
              channelId: update.id,
              writers: writers || [],
              readers: readers || [],
            },
          ],
          txCtx
        );
      }

      return txCtx.db
        .update($channels)
        .set(update)
        .where(eq($channels.id, update.id));
    });
  },
  ['channels', 'channelWriters', 'channelReaders']
);

export const deleteChannels = createWriteQuery(
  'deleteChannels',
  async (channels: string[], ctx: QueryCtx) => {
    logger.log(`deleteChannels`, channels);
    await ctx.db.delete($posts).where(inArray($posts.channelId, channels));
    await ctx.db
      .delete($chatMembers)
      .where(inArray($chatMembers.chatId, channels));
    await ctx.db.delete($channels).where(inArray($channels.id, channels));
    return;
  },
  ['channels', 'posts', 'chatMembers']
);

export const addNavSectionToGroup = createWriteQuery(
  'addNavSectionToGroup',
  async (
    {
      id,
      sectionId,
      groupId,
      meta,
    }: {
      id: string;
      sectionId: string;
      groupId: string;
      meta: ClientMeta;
    },
    ctx: QueryCtx
  ) => {
    logger.log('addNavSectionToGroup', id, sectionId, groupId, meta);

    return ctx.db
      .insert($groupNavSections)
      .values({
        id,
        sectionId: sectionId,
        title: meta.title,
        description: meta.description,
        iconImage: meta.iconImage,
        coverImage: meta.coverImage,
        iconImageColor: meta.iconImageColor,
        coverImageColor: meta.coverImageColor,
        groupId,
      })
      .onConflictDoUpdate({
        target: $groupNavSections.id,
        set: conflictUpdateSetAll($groupNavSections),
      });
  },
  ['groups', 'groupNavSections', 'groupNavSectionChannels']
);

export const updateNavSectionChannel = createWriteQuery(
  'updateNavSectionChannel',
  async (
    {
      channelId,
      groupNavSectionId,
      channelIndex,
    }: {
      channelId: string;
      groupNavSectionId: string;
      channelIndex: number;
    },
    ctx: QueryCtx
  ) => {
    return ctx.db
      .update($groupNavSectionChannels)
      .set({ channelIndex })
      .where(
        and(
          eq($groupNavSectionChannels.channelId, channelId),
          eq($groupNavSectionChannels.groupNavSectionId, groupNavSectionId)
        )
      );
  },
  ['groupNavSectionChannels']
);

export const updateNavSection = createWriteQuery(
  'updateNavSection',
  async (
    navSection: Partial<GroupNavSection> & { id: string },
    ctx: QueryCtx
  ) => {
    logger.log('updateNavSection', navSection);
    return ctx.db
      .update($groupNavSections)
      .set(navSection)
      .where(eq($groupNavSections.id, navSection.id));
  },
  ['groupNavSections']
);

export const deleteNavSection = createWriteQuery(
  'deleteNavSection',
  async (navSectionId: string, ctx: QueryCtx) => {
    return ctx.db
      .delete($groupNavSections)
      .where(eq($groupNavSections.id, navSectionId));
  },
  ['groupNavSections']
);

export const addChannelToNavSection = createWriteQuery(
  'addChannelToNavSection',
  async (
    {
      channelId,
      groupNavSectionId,
      index,
    }: {
      channelId: string;
      groupNavSectionId: string;
      index: number;
    },
    ctx: QueryCtx
  ) => {
    logger.log('addChannelToNavSection', channelId, groupNavSectionId, index);
    return ctx.db
      .insert($groupNavSectionChannels)
      .values({
        channelId,
        groupNavSectionId,
        channelIndex: index,
      })
      .onConflictDoNothing();
  },
  ['groupNavSectionChannels', 'groups']
);

export const deleteChannelFromNavSection = createWriteQuery(
  'deleteChannelFromNavSection',
  async (
    {
      channelId,
      groupNavSectionId,
    }: {
      channelId: string;
      groupNavSectionId: string;
    },
    ctx: QueryCtx
  ) => {
    logger.log('deleteChannelFromNavSection', channelId, groupNavSectionId);
    return ctx.db
      .delete($groupNavSectionChannels)
      .where(
        and(
          eq($groupNavSectionChannels.channelId, channelId),
          eq($groupNavSectionChannels.groupNavSectionId, groupNavSectionId)
        )
      );
  },
  ['groupNavSectionChannels']
);

export const getChannelNavSection = createReadQuery(
  'getChannelNavSection',
  async ({ channelId }: { channelId: string }, ctx: QueryCtx) => {
    return ctx.db.query.groupNavSectionChannels
      .findFirst({
        where: eq($groupNavSectionChannels.channelId, channelId),
        with: {
          groupNavSection: true,
        },
      })
      .then(returnNullIfUndefined);
  },
  ['groupNavSectionChannels']
);

/* This sets which channels the current user is a member of, which is what we key off of
when determining channels to show in the UI. There's no direct setting for this on
the backend. Instead we look at two things:
   1) do you have an unreads entry for the channel?
   2) if you do, do you have read permissions for it?
    Read permissions are stored as an array of roles. If the array is empty, anyone
    can read the channel. If it's not empty, we check to make sure the user has one of the
    reader roles.
*/
export const setJoinedGroupChannels = createWriteQuery(
  'setJoinedGroupChannels',
  async ({ channelIds }: { channelIds: string[] }, ctx: QueryCtx) => {
    const currentUserId = getCurrentUserId();
    if (channelIds.length === 0) return;

    const channels = await ctx.db.query.channels.findMany({
      with: {
        readerRoles: true,
        group: {
          with: {
            roles: {
              with: {
                members: true,
              },
            },
          },
        },
      },
    });
    const channelsIndex = new Map<string, Channel>();
    for (const channel of channels) {
      channelsIndex.set(channel.id, channel);
    }

    const channelsWhereMember = channelIds.filter((id) => {
      const channel = channelsIndex.get(id);
      const isOpenChannel = channel?.readerRoles?.length === 0;

      const userRolesForGroup =
        channel?.group?.roles
          ?.filter((role) =>
            role.members?.map((m) => m.contactId).includes(currentUserId)
          )
          .map((role) => role.id) ?? [];

      const isClosedButCanRead = channel?.readerRoles
        ?.map((r) => r.roleId)
        .some((r) => userRolesForGroup.includes(r));
      return isOpenChannel || isClosedButCanRead;
    });
    if (channelsWhereMember.length) {
      logger.log('setJoinedGroupChannels', channelIds);
      return await ctx.db
        .update($channels)
        .set({
          currentUserIsMember: inArray($channels.id, channelsWhereMember),
        })
        .where(isNotNull($channels.groupId));
    }
  },
  ['channels']
);

export const addJoinedGroupChannel = createWriteQuery(
  'addJoinedGroupChannel',
  async ({ channelId }: { channelId: string }, ctx: QueryCtx) => {
    logger.log('addJoinedGroupChannel', channelId);

    // First update the channel membership
    await ctx.db
      .update($channels)
      .set({
        currentUserIsMember: true,
      })
      .where(eq($channels.id, channelId));

    // Then check if channel exists in any section
    const existingInAnySection = await ctx.db
      .select()
      .from($groupNavSectionChannels)
      .where(eq($groupNavSectionChannels.channelId, channelId));

    // Only add to default if it's not
    if (existingInAnySection.length === 0) {
      await ctx.db.insert($groupNavSectionChannels).values({
        channelId,
        groupNavSectionId: 'default',
      });
    }

    return;
  },
  ['channels']
);

export const removeJoinedGroupChannel = createWriteQuery(
  'removeJoinedGroupChannel',
  async ({ channelId }: { channelId: string }, ctx: QueryCtx) => {
    return await ctx.db
      .update($channels)
      .set({
        currentUserIsMember: false,
      })
      .where(eq($channels.id, channelId));
  },
  ['channels']
);

export const setLeftGroupChannels = createWriteQuery(
  'setLeftGroupChannels',
  async (
    { joinedChannelIds }: { joinedChannelIds: string[] },
    ctx: QueryCtx
  ) => {
    if (joinedChannelIds.length === 0) return;
    return await ctx.db
      .update($channels)
      .set({
        currentUserIsMember: false,
      })
      .where(
        and(
          notInArray($channels.id, joinedChannelIds),
          isNotNull($channels.groupId),
          eq($channels.currentUserIsMember, true)
        )
      );
  },
  ['channels']
);

export const setLeftGroups = createWriteQuery(
  'setLeftGroups',
  async ({ joinedGroupIds }: { joinedGroupIds: string[] }, ctx: QueryCtx) => {
    if (joinedGroupIds.length === 0) return;
    return await ctx.db
      .update($groups)
      .set({
        currentUserIsMember: false,
      })
      .where(
        and(
          notInArray($groups.id, joinedGroupIds),
          eq($groups.currentUserIsMember, true)
        )
      );
  },
  ['groups', 'channels']
);

export const getPostWindow = createReadQuery(
  'getPostWindow',
  async (
    {
      channelId,
      postId,
    }: {
      channelId: string;
      /**
       * Find window containing this post ID.
       * If omitted, returns window with newest post.
       */
      postId: string | null;
    },
    ctx: QueryCtx
  ) => {
    // Find the window (set of contiguous posts) that this cursor belongs to.
    // These are the posts that we can return safely without gaps and without hitting the api.
    return await ctx.db.query.postWindows.findFirst({
      where: and(
        // For this channel
        eq($postWindows.channelId, channelId),

        // window.oldest <= postId <= window.newest
        postId ? gte($postWindows.newestPostId, postId) : undefined,
        postId ? lte($postWindows.oldestPostId, postId) : undefined
      ),
      orderBy: [desc($postWindows.newestPostId)],
      columns: {
        oldestPostId: true,
        newestPostId: true,
      },
    });
  },
  ['postWindows']
);

export type GetChannelPostsOptions = {
  channelId: string;
  count?: number;
  mode: 'newest' | 'older' | 'newer' | 'around';
  cursor?: string;
};

export const getChannelPosts = createReadQuery(
  'getChannelPosts',
  async (
    { channelId, cursor, mode, count = 50 }: GetChannelPostsOptions,
    ctx: QueryCtx
  ): Promise<Post[]> => {
    // Find the window (set of contiguous posts) that this cursor belongs to.
    // These are the posts that we can return safely without gaps and without hitting the api.
    const window = await getPostWindow(
      { channelId, postId: cursor ?? null },
      ctx
    );
    // If the cursor isn't part of any window, we return an empty array.
    if (!window) {
      return [];
    }

    const relationConfig = {
      author: true,
      reactions: {
        with: {
          contact: true,
        },
      },
      threadUnread: true,
      volumeSettings: true,
    } as const;

    if (mode === 'newer' || mode === 'newest' || mode === 'older') {
      // Simple case: just grab a set of posts from either side of the cursor.
      const posts = await ctx.db.query.posts.findMany({
        where: and(
          // From this channel
          eq($posts.channelId, channelId),
          // Not a reply
          not(eq($posts.type, 'reply')),
          // In the target window
          gte($posts.id, window.oldestPostId),
          lte($posts.id, window.newestPostId),
          // Depending on mode, either older or newer than cursor. If mode is
          // `newest`, we don't need to filter by cursor.
          cursor && mode === 'older' ? lt($posts.id, cursor) : undefined,
          cursor && mode === 'newer' ? gt($posts.id, cursor) : undefined
        ),
        with: relationConfig,
        // If newer, we have to ensure that these are the newer posts directly following the cursor
        orderBy: [mode === 'newer' ? asc($posts.id) : desc($posts.id)],
        limit: count,
      });
      // We always want to return posts newest-first
      if (mode === 'newer') {
        posts.reverse();
      }
      return posts;
    } else if (mode === 'around') {
      if (!cursor) {
        throw new Error('missing cursor');
      }

      // It's a bit more complicated to get posts around a cursor. Basic process is:
      // - Start with a query for all posts in the window, selecting
      //   row_number() to track their position within the window.
      // - Find the row number of the cursor post within this window.
      // - Find min row and max row by offsetting the cursor row by half the
      //   count in each direction.
      // - Grab post ids from the window query where row number is between min and max.

      // Get all posts in the window
      const $windowQuery = ctx.db
        .select({
          id: $posts.id,
          rowNumber: sql`row_number() OVER (ORDER BY ${$posts.id})`
            .mapWith(Number)
            .as('rowNumber'),
        })
        .from($posts)
        .where(
          and(
            eq($posts.channelId, channelId),
            not(eq($posts.type, 'reply')),
            gte($posts.id, window.oldestPostId),
            lte($posts.id, window.newestPostId)
          )
        )
        .as('posts');

      // Get the row number of the cursor post
      const position = await ctx.db
        .select({
          // finds the highest row number for posts with IDs less than or equal to the cursor.
          // If the cursor posts, exists, it will be the row number of that post.
          index:
            sql`coalesce(max(case when ${$windowQuery.id} <= ${cursor} then ${$windowQuery.rowNumber} end), 0)`
              .mapWith(Number)
              .as('index'),
        })
        .from($windowQuery)
        .get();

      if (!position) {
        return [];
      }

      // Calculate min and max rows
      const itemsBefore = Math.floor((count - 1) / 2);
      const itemsAfter = Math.ceil((count - 1) / 2);
      const startRow = position.index - itemsBefore;
      const endRow = position.index + itemsAfter;

      // Actually grab posts
      return await ctx.db.query.posts.findMany({
        where: inArray(
          $posts.id,
          ctx.db
            .select({
              id: $windowQuery.id,
            })
            .from($windowQuery)
            .where(
              and(
                gte($windowQuery.rowNumber, startRow),
                lte($windowQuery.rowNumber, endRow)
              )
            )
        ),
        with: relationConfig,
        orderBy: [desc($posts.id)],
        limit: count,
      });
    } else {
      throw new Error('invalid mode');
    }
  },
  ['posts']
);

export const getPostsByStatus = createReadQuery(
  'getPostsByStatus',
  async (
    { deliveryStatus }: { deliveryStatus: Post['deliveryStatus'] },
    ctx: QueryCtx
  ) => {
    if (!deliveryStatus) return [];
    return ctx.db.query.posts.findMany({
      where: eq($posts.deliveryStatus, deliveryStatus),
    });
  },
  ['posts']
);

export interface GetChannelPostsAroundOptions {
  channelId: string;
  postId: string;
}

export const getChannelPostsAround = createReadQuery(
  'getChannelPosts',
  async (
    { channelId, postId }: { channelId: string; postId: string },
    ctx: QueryCtx
  ) => {
    if (!postId) return [];

    // Get desired post
    const referencePost = await ctx.db.query.posts.findFirst({
      where: eq($posts.id, postId),
      with: {
        author: true,
        reactions: {
          with: {
            contact: true,
          },
        },
      },
    });

    if (!referencePost) {
      throw new Error('Reference post not found');
    }

    const sentAt = referencePost.sentAt;

    // Get before posts
    const beforePosts = await ctx.db.query.posts.findMany({
      where: and(eq($posts.channelId, channelId), lt($posts.sentAt, sentAt!)),
      orderBy: [desc($posts.receivedAt)],
      limit: 25,
      with: {
        author: true,
        reactions: {
          with: {
            contact: true,
          },
        },
      },
    });

    // Get after posts
    const afterPosts = await ctx.db.query.posts.findMany({
      where: and(eq($posts.channelId, channelId), gt($posts.sentAt, sentAt!)),
      orderBy: [asc($posts.receivedAt)],
      limit: 25,
      with: {
        author: true,
        reactions: {
          with: {
            contact: true,
          },
        },
      },
    });

    // Return all posts in order
    return [...beforePosts.reverse(), referencePost, ...afterPosts];
  },
  ['posts', 'channels']
);

export const getChannelSearchResults = createReadQuery(
  'getChannelSearchResults',
  async (
    { channelId, postIds }: { channelId: string; postIds: string[] },
    ctx: QueryCtx
  ) => {
    if (postIds.length === 0) return [];
    return ctx.db.query.posts.findMany({
      where: and(eq($posts.channelId, channelId), inArray($posts.id, postIds)),
      orderBy: [desc($posts.receivedAt)],
      with: {
        author: true,
        reactions: {
          with: {
            contact: true,
          },
        },
      },
    });
  },
  []
);

export const insertChannelPosts = createWriteQuery(
  'insertChannelPosts',
  async (
    {
      channelId,
      posts,
      newer,
      older,
    }: {
      channelId: string;
      posts: Post[];
      newer?: string | null;
      older?: string | null;
    },
    ctx: QueryCtx
  ) => {
    if (!posts.length) {
      return;
    }
    return withTransactionCtx(ctx, async (txCtx) => {
      logger.log(
        'inserting posts',
        posts.map((p) => p.id)
      );
      await insertPosts(posts, txCtx);
      logger.log('inserted posts');
      // If these are non-reply posts, update group + channel last post as well as post windows.
      const topLevelPosts = posts.filter((p) => p.type !== 'reply');
      if (topLevelPosts.length) {
        logger.log('updating post windows');
        await updatePostWindows(
          {
            channelId,
            newPosts: topLevelPosts,
            newer,
            older,
          },
          txCtx
        );
        logger.log('updated windows');
      }
    });
  },
  ['posts', 'postWindows']
);

export const insertLatestPosts = createWriteQuery(
  'insertLatestPosts',
  async (posts: Post[], ctx: QueryCtx) => {
    if (!posts.length) {
      return;
    }
    return withTransactionCtx(ctx, async (txCtx) => {
      logger.log(
        'inserting latest posts to',
        posts.map((p) => p.channelId)
      );
      await insertPosts(posts, txCtx);
      const postUpdates = posts.map((post) => ({
        channelId: post.channelId,
        newPosts: [post],
      }));
      await Promise.all(postUpdates.map((p) => updatePostWindows(p, txCtx)));
    });
  },
  ['posts']
);

const insertPostsBatchSize = 300;

async function insertPosts(posts: Post[], ctx: QueryCtx) {
  for (let i = 0; i < posts.length; i += insertPostsBatchSize) {
    const batch = posts.slice(i, i + insertPostsBatchSize);
    await insertPostsBatch(batch, ctx);
  }
}

async function insertPostsBatch(posts: Post[], ctx: QueryCtx) {
  logger.log(
    'inserting post batch',
    posts.map((p) => [p.id, p.channelId])
  );

  // Check if we have pending hidden post IDs to apply
  const settings = await ctx.db.query.settings.findFirst({
    where: eq($settings.id, SETTINGS_SINGLETON_KEY),
  });
  const pendingHiddenIds = Array.isArray(settings?.pendingHiddenPostIds)
    ? (settings.pendingHiddenPostIds as string[])
    : [];

  if (pendingHiddenIds.length > 0) {
    logger.log('Found pending hidden post IDs:', pendingHiddenIds);
  }

  const pendingHiddenIdsSet = new Set(pendingHiddenIds);

  // Apply hidden state to posts that match pending IDs
  const postsWithHiddenState = posts.map((p) => ({
    ...p,
    hidden: pendingHiddenIdsSet.has(p.id) || p.hidden,
  }));

  // Track which posts were marked as hidden from the pending list
  const hiddenFromPending = posts.filter((p) => pendingHiddenIdsSet.has(p.id));
  const hiddenInBatch = postsWithHiddenState.filter((p) => p.hidden);

  if (hiddenInBatch.length > 0) {
    logger.log(
      'Marking posts as hidden during insert:',
      hiddenInBatch.map((p) => p.id)
    );
  }

  await ctx.db
    .insert($posts)
    .values(
      postsWithHiddenState.map((p) => ({
        ...p,
        groupId: sql`(SELECT ${$channels.groupId} FROM ${$channels} WHERE ${$channels.id} = ${p.channelId})`,
      }))
    )
    .onConflictDoUpdate({
      target: $posts.id,
      set: conflictUpdateSetAll($posts, ['hidden']),
    })
    .onConflictDoUpdate({
      target: [$posts.authorId, $posts.channelId, $posts.sentAt],
      set: conflictUpdateSetAll($posts, ['hidden']),
    });

  const reactions = posts
    .filter((p) => p.reactions && p.reactions.length > 0)
    .flatMap((p) => p.reactions) as Reaction[];
  logger.log('inserting post reactions', reactions);
  if (reactions.length) {
    await ctx.db
      .insert($postReactions)
      .values(reactions)
      .onConflictDoUpdate({
        target: [$postReactions.contactId, $postReactions.postId],
        set: conflictUpdateSetAll($postReactions),
      });
  }

  logger.log('inserted posts');
  await setLastPosts(posts, ctx);
  logger.log('set last posts');
  await clearMatchedPendingPosts(
    posts.filter((p) => p.deliveryStatus !== 'pending'),
    ctx
  );
  logger.log('clear matched pending');

  // Clean up applied hidden post IDs from the pending list
  if (hiddenFromPending.length > 0 && pendingHiddenIds.length > 0) {
    const appliedIds = new Set(hiddenFromPending.map((p) => p.id));
    const remainingPendingIds = pendingHiddenIds.filter(
      (id) => !appliedIds.has(id)
    );

    await ctx.db
      .update($settings)
      .set({ pendingHiddenPostIds: remainingPendingIds })
      .where(eq($settings.id, SETTINGS_SINGLETON_KEY));

    logger.log(
      'Cleaned up applied hidden IDs, remaining:',
      remainingPendingIds.length
    );
  }
}

export const resetHiddenPosts = createWriteQuery(
  'resetHiddenPosts',
  async (postIds: string[], ctx: QueryCtx) => {
    if (postIds.length === 0) {
      logger.log('resetHiddenPosts called with empty array');
      // Clear stored hidden post IDs if empty array
      await ctx.db
        .insert($settings)
        .values({ id: SETTINGS_SINGLETON_KEY, pendingHiddenPostIds: [] })
        .onConflictDoUpdate({
          target: $settings.id,
          set: { pendingHiddenPostIds: [] },
        });
      return;
    }

    logger.log(
      'resetHiddenPosts called with',
      postIds.length,
      'posts:',
      postIds
    );

    // Store the hidden post IDs in settings for later application
    await ctx.db
      .insert($settings)
      .values({ id: SETTINGS_SINGLETON_KEY, pendingHiddenPostIds: postIds })
      .onConflictDoUpdate({
        target: $settings.id,
        set: { pendingHiddenPostIds: postIds },
      });
    logger.log('Stored hidden post IDs in settings for later application');

    // Check what posts exist with these IDs
    const existingPosts = await ctx.db.query.posts.findMany({
      where: inArray($posts.id, postIds),
      columns: { id: true },
    });
    logger.log(
      'Found matching posts in DB:',
      existingPosts.map((p) => p.id)
    );

    // Update any posts that already exist
    if (existingPosts.length > 0) {
      const existingIds = existingPosts.map((p) => p.id);
      await ctx.db
        .update($posts)
        .set({ hidden: true })
        .where(inArray($posts.id, existingIds));
      logger.log('Updated existing posts to hidden:', existingIds);
    }

    // Also unhide posts that should no longer be hidden
    const currentlyHidden = await ctx.db.query.posts.findMany({
      where: eq($posts.hidden, true),
      columns: { id: true },
    });
    const idsToUnhide = currentlyHidden
      .map((p) => p.id)
      .filter((id) => !postIds.includes(id));

    if (idsToUnhide.length > 0) {
      await ctx.db
        .update($posts)
        .set({ hidden: false })
        .where(inArray($posts.id, idsToUnhide));
      logger.log('Unhid posts:', idsToUnhide);
    }
  },
  ['posts', 'settings']
);

export const getHiddenPosts = createReadQuery(
  'getHiddenPosts',
  async (ctx: QueryCtx) => {
    return ctx.db.query.posts.findMany({
      where: eq($posts.hidden, true),
    });
  },
  ['posts']
);

async function setLastPosts(newPosts: Post[] | null, ctx: QueryCtx) {
  const channelIds = newPosts?.map((p) => p.channelId) ?? [];

  if (channelIds.length === 0) return;

  // Combine channel and group updates in a single transaction
  // Update channels
  await ctx.db
    .update($channels)
    .set({
      lastPostId: sql`${ctx.db
        .select({ id: $posts.id })
        .from($posts)
        .where(
          and(eq($posts.channelId, $channels.id), not(eq($posts.type, 'reply')))
        )
        .orderBy(desc($posts.receivedAt))
        .limit(1)}`,
      lastPostAt: sql`${ctx.db
        .select({ receivedAt: $posts.receivedAt })
        .from($posts)
        .where(
          and(eq($posts.channelId, $channels.id), not(eq($posts.type, 'reply')))
        )
        .orderBy(desc($posts.receivedAt))
        .limit(1)}`,
    })
    .where(
      and(
        inArray($channels.id, channelIds),
        or(
          isNull($channels.lastPostId),
          lt(
            $channels.lastPostId,
            ctx.db
              .select({ maxId: max($posts.id) })
              .from($posts)
              .where(eq($posts.channelId, $channels.id))
          )
        )
      )
    );

  // Update groups
  const updatedChannelIds = await ctx.db
    .select({ id: $channels.id, groupId: $channels.groupId })
    .from($channels)
    .where(inArray($channels.id, channelIds));

  const updatedGroupIds: string[] = [
    ...new Set(updatedChannelIds.map((c) => c.groupId)),
  ] as string[];

  if (!updatedGroupIds.length) return;

  await ctx.db
    .update($groups)
    .set({
      lastPostId: sql`${ctx.db
        .select({ lastPostId: $channels.lastPostId })
        .from($channels)
        .where(eq($channels.groupId, $groups.id))
        .orderBy(desc($channels.lastPostAt))
        .limit(1)}`,
      lastPostAt: sql`${ctx.db
        .select({ lastPostAt: $channels.lastPostAt })
        .from($channels)
        .where(eq($channels.groupId, $groups.id))
        .orderBy(desc($channels.lastPostAt))
        .limit(1)}`,
    })
    .where(
      and(
        inArray($groups.id, updatedGroupIds),
        or(
          isNull($groups.lastPostId),
          lt(
            $groups.lastPostId,
            ctx.db
              .select({ maxId: max($posts.id) })
              .from($posts)
              .where(eq($posts.groupId, $groups.id))
          )
        )
      )
    );
}

// Delete any pending posts whose sentAt matches the incoming sentAt.
// We do this manually as pending post ids do not correspond to server-side post ids.
async function clearMatchedPendingPosts(posts: Post[], ctx: QueryCtx) {
  const deliveredPosts = posts.filter((p) => p.deliveryStatus !== 'pending');
  if (!deliveredPosts.length) {
    return;
  }
  return await ctx.db
    .delete($posts)
    .where(
      and(
        eq($posts.deliveryStatus, 'pending'),
        inArray(
          $posts.sentAt,
          deliveredPosts.map((p) => p.sentAt)
        )
      )
    )
    .returning({ id: $posts.id });
}

async function updatePostWindows(
  {
    channelId,
    newPosts,
    newer,
    older,
  }: {
    channelId: string;
    newPosts: Post[];
    newer?: string | null;
    older?: string | null;
  },
  ctx: QueryCtx
) {
  // Create candidate window based on input
  const window = {
    channelId,
    newestPostId: newPosts[newPosts.length - 1].id,
    oldestPostId: newPosts[0].id,
  };

  const referenceWindow = {
    channelId,
    newestPostId: newer || window.newestPostId,
    oldestPostId: older || window.oldestPostId,
  };

  // Calculate min and max post id of windows that overlap with this one
  const { oldestId, newestId } = (
    await ctx.db
      .select({
        oldestId: min($postWindows.oldestPostId),
        newestId: max($postWindows.newestPostId),
      })
      .from($postWindows)
      .where(overlapsWindow(referenceWindow))
  )[0];

  logger.log(
    'deleting intersecting windows',
    referenceWindow,
    oldestId,
    newestId
  );
  // Delete intersecting windows.
  await ctx.db.delete($postWindows).where(overlapsWindow(referenceWindow));

  // Calculate final range of merged windows by intersecting existing min and
  // max with candidate window.
  const resolvedStart =
    oldestId && oldestId < window.oldestPostId ? oldestId : window.oldestPostId;
  const resolvedEnd =
    newestId && newestId > window.newestPostId ? newestId : window.newestPostId;

  const finalWindow = {
    channelId: window.channelId,
    oldestPostId: resolvedStart,
    newestPostId: resolvedEnd,
  };

  logger.log('inserting final window', finalWindow);
  // Insert final window.
  await ctx.db.insert($postWindows).values(finalWindow).onConflictDoNothing();
}

function overlapsWindow(window: PostWindow) {
  return and(
    eq($postWindows.channelId, window.channelId),
    lte($postWindows.oldestPostId, window.newestPostId),
    gte($postWindows.newestPostId, window.oldestPostId)
  );
}

export const updatePost = createWriteQuery(
  'updateChannelPost',
  async (post: Partial<Post> & { id: string }, ctx: QueryCtx) => {
    return withTransactionCtx(ctx, async (txCtx) => {
      return txCtx.db.update($posts).set(post).where(eq($posts.id, post.id));
    });
  },
  ['posts']
);

export const deletePost = createWriteQuery(
  'deleteChannelPost',
  async (postId: string, ctx: QueryCtx) => {
    return ctx.db.delete($posts).where(eq($posts.id, postId));
  },
  ['posts']
);

export const markPostAsDeleted = createWriteQuery(
  'markPostAsDeleted',
  async (postId: string, ctx: QueryCtx) => {
    return ctx.db
      .update($posts)
      .set({
        isDeleted: true,
        content: null,
        textContent: null,
        authorId: undefined,
        title: null,
        image: null,
      })
      .where(eq($posts.id, postId));
  },
  ['posts']
);

export const getPostReaction = createReadQuery(
  'getPostReaction',
  async (
    { postId, contactId }: { postId: string; contactId: string },
    ctx: QueryCtx
  ) => {
    return ctx.db.query.postReactions
      .findFirst({
        where: and(
          eq($postReactions.postId, postId),
          eq($postReactions.contactId, contactId)
        ),
      })
      .then(returnNullIfUndefined);
  },
  []
);

export const insertPostReactions = createWriteQuery(
  'insertPostReactions',
  async ({ reactions }: { reactions: Reaction[] }, ctx: QueryCtx) => {
    return ctx.db
      .insert($postReactions)
      .values(reactions)
      .onConflictDoUpdate({
        target: [$postReactions.postId, $postReactions.contactId],
        set: conflictUpdateSetAll($postReactions),
      });
  },
  ['posts', 'postReactions', 'contacts']
);

export const replacePostReactions = createWriteQuery(
  'setPostReactions',
  async (
    { postId, reactions }: { postId: string; reactions: Reaction[] },
    ctx: QueryCtx
  ) => {
    return withTransactionCtx(ctx, async (txCtx) => {
      await txCtx.db
        .delete($postReactions)
        .where(eq($postReactions.postId, postId));
      if (reactions.length === 0) return;
      await txCtx.db.insert($postReactions).values(reactions);
    });
  },
  ['posts', 'postReactions']
);

export const deletePostReaction = createWriteQuery(
  'deletePostReaction',
  async (
    { postId, contactId }: { postId: string; contactId: string },
    ctx: QueryCtx
  ) => {
    return ctx.db
      .delete($postReactions)
      .where(
        and(
          eq($postReactions.postId, postId),
          eq($postReactions.contactId, contactId)
        )
      );
  },
  ['posts', 'postReactions']
);

export const deletePosts = createWriteQuery(
  'deletePosts',
  async ({ ids }: { ids: string[] }, ctx: QueryCtx) => {
    return ctx.db.delete($posts).where(inArray($posts.id, ids));
  },
  ['posts']
);

export const getPosts = createReadQuery(
  'getPosts',
  (ctx: QueryCtx) => {
    return ctx.db.select().from($posts);
  },
  ['posts']
);

export const getPost = createReadQuery(
  'getPost',
  async ({ postId }: { postId: string }, ctx: QueryCtx) => {
    const postData = await ctx.db
      .select()
      .from($posts)
      .where(eq($posts.id, postId));
    if (!postData.length) return null;
    return postData[0];
  },
  ['posts']
);

export const getPostByBackendTime = createReadQuery(
  'getPostByBackendTime',
  async ({ backendTime }: { backendTime: string }, ctx: QueryCtx) => {
    const postData = await ctx.db
      .select()
      .from($posts)
      .where(eq($posts.backendTime, backendTime));
    if (!postData.length) return null;
    return postData[0];
  },
  ['posts']
);

export const getPostByCacheId = createReadQuery(
  'getPostByCacheId',
  async (
    {
      channelId,
      sentAt,
      authorId,
    }: { channelId: string; sentAt: number; authorId: string },
    ctx: QueryCtx
  ) => {
    const postData = await ctx.db
      .select()
      .from($posts)
      .where(
        and(
          eq($posts.sentAt, sentAt),
          eq($posts.authorId, authorId),
          eq($posts.channelId, channelId)
        )
      );
    if (!postData.length) return null;
    return postData[0];
  },
  ['posts']
);

export const addReplyToPost = createWriteQuery(
  'addReplyToPost',
  async (
    {
      parentId,
      replyAuthor,
      replyTime,
      replyMeta,
    }: {
      parentId: string;
      replyAuthor: string;
      replyTime: number;
      replyMeta?: ReplyMeta | null; // sometimes passed via API, preferred over derived values
    },
    ctx: QueryCtx
  ) => {
    return withTransactionCtx(ctx, async (txCtx) => {
      const parentData = await ctx.db
        .select()
        .from($posts)
        .where(eq($posts.id, parentId));
      if (parentData.length) {
        const parentPost = parentData[0];
        const newReplyContacts = appendContactIdToReplies(
          parentPost.replyContactIds ?? [],
          replyAuthor
        );
        return txCtx.db
          .update($posts)
          .set({
            replyCount:
              replyMeta?.replyCount ?? (parentPost.replyCount ?? 0) + 1,
            replyTime: replyMeta?.replyTime ?? replyTime,
            replyContactIds: replyMeta?.replyContactIds ?? newReplyContacts,
          })
          .where(eq($posts.id, parentId));
      }
    });
  },
  ['posts']
);

export const getPendingPosts = createReadQuery(
  'getPendingPosts',
  (channelId: string, ctx: QueryCtx) => {
    return ctx.db.query.posts.findMany({
      where: and(
        eq($posts.channelId, channelId),
        isNotNull($posts.deliveryStatus)
      ),
    });
  },
  ['posts']
);

export const getEnqueuedPosts = createReadQuery(
  'getEnqueuedPosts',
  (ctx: QueryCtx) => {
    return ctx.db.query.posts.findMany({
      where: eq($posts.deliveryStatus, 'enqueued'),
      with: {
        channel: true,
      },
    });
  },
  ['posts']
);

export const getPostWithRelations = createReadQuery(
  'getPostWithRelations',
  async ({ id }: { id: string }, ctx: QueryCtx): Promise<Post | null> => {
    return ctx.db.query.posts
      .findFirst({
        where: eq($posts.id, id),
        with: {
          author: true,
          reactions: {
            with: {
              contact: true,
            },
          },
          threadUnread: true,
          volumeSettings: true,
        },
      })
      .then(returnNullIfUndefined);
  },
  ['posts', 'postReactions', 'threadUnreads', 'volumeSettings']
);

export const getPersonalGroup = createReadQuery(
  'getPersonalGroup',
  async (ctx: QueryCtx) => {
    const currentUserId = getCurrentUserId();
    const groupId = `${currentUserId}/${domain.PersonalGroupSlugs.slug}`;
    const group = await getGroup({ id: groupId }, ctx);
    return group;
  },
  [
    'groups',
    'channelUnreads',
    'volumeSettings',
    'channels',
    'groupJoinRequests',
    'groupMemberBans',
    'groupNavSectionChannels',
    'groupRoles',
  ]
);

export const getGroup = createReadQuery(
  'getGroup',
  async (
    {
      id,
      includeUnjoinedChannels = false,
    }: { id: string; includeUnjoinedChannels?: boolean },
    ctx: QueryCtx
  ) => {
    return ctx.db.query.groups
      .findFirst({
        where: (groups, { eq }) => eq(groups.id, id),
        with: {
          unread: true,
          pin: true,
          channels: {
            where: includeUnjoinedChannels
              ? undefined
              : (channels, { eq }) => eq(channels.currentUserIsMember, true),
            with: {
              lastPost: true,
              unread: true,
              volumeSettings: true,
              writerRoles: true,
              readerRoles: true,
            },
          },
          roles: true,
          members: {
            with: {
              contact: true,
              roles: true,
            },
          },
          joinRequests: true,
          bannedMembers: true,
          navSections: {
            with: {
              channels: true,
            },
          },
          volumeSettings: true,
        },
      })
      .then(returnNullIfUndefined);
  },
  [
    'groups',
    'channelUnreads',
    'volumeSettings',
    'channels',
    'groupJoinRequests',
    'groupMemberBans',
    'groupNavSectionChannels',
    'groupRoles',
  ]
);

export const getGroupByChannel = createReadQuery(
  'getGroupByChannel',
  async (channelId: string, ctx: QueryCtx) => {
    const channel = await ctx.db.query.channels.findFirst({
      where: (channels, { eq }) => eq(channels.id, channelId),
    });

    if (!channel || !channel.groupId) return null;

    return ctx.db.query.groups
      .findFirst({
        where: (groups, { eq }) => eq(groups.id, channel.groupId!),
        with: {
          channels: true,
          roles: true,
          members: true,
        },
      })
      .then(returnNullIfUndefined);
  },
  ['channels', 'groups']
);

export const insertBlockedContacts = createWriteQuery(
  'insertBlockedContacts',
  async ({ blockedIds }: { blockedIds: string[] }, ctx: QueryCtx) => {
    if (blockedIds.length === 0) return;

    const blockedContacts: Contact[] = blockedIds.map((id) => ({
      id,
      isBlocked: true,
    }));

    return ctx.db
      .insert($contacts)
      .values(blockedContacts)
      .onConflictDoUpdate({
        target: $contacts.id,
        set: conflictUpdateSet($contacts.isBlocked),
      });
  },
  ['contacts']
);

export const getBlockedUsers = createReadQuery(
  'getBlockedUsers',
  async (ctx: QueryCtx) => {
    return ctx.db.query.contacts.findMany({
      where: eq($contacts.isBlocked, true),
    });
  },
  ['contacts']
);

export const getContacts = createReadQuery(
  'getContacts',
  async (ctx: QueryCtx) => {
    return ctx.db.query.contacts.findMany({
      with: {
        pinnedGroups: {
          with: {
            group: true,
          },
        },
        attestations: {
          with: {
            attestation: true,
          },
        },
      },
    });
  },
  ['contacts', 'contactAttestations']
);

export const getContactsBatch = createReadQuery(
  'getContactsBatch',
  async ({ contactIds }: { contactIds: string[] }, ctx: QueryCtx) => {
    if (contactIds.length === 0) return [];
    return ctx.db.query.contacts.findMany({
      where: (contacts, { inArray }) => inArray(contacts.id, contactIds),
    });
  },
  ['contacts']
);

export const getContactsCount = createReadQuery(
  'getContactsCount',
  async (ctx: QueryCtx) => {
    const result = await ctx.db.select({ count: count() }).from($contacts);
    return result[0].count;
  },
  ['contacts']
);

export const getContact = createReadQuery(
  'getContact',
  async ({ id }: { id: string }, ctx: QueryCtx) => {
    return ctx.db.query.contacts
      .findFirst({
        where: (contacts, { eq }) => eq(contacts.id, id),
        with: {
          pinnedGroups: {
            with: {
              group: true,
            },
          },
          attestations: {
            with: {
              attestation: true,
            },
          },
        },
      })
      .then(returnNullIfUndefined);
  },
  ['contacts', 'groups', 'contactAttestations']
);

export const updateContact = createWriteQuery(
  'updateContact',
  async (contact: Partial<Contact> & { id: string }, ctx: QueryCtx) => {
    return ctx.db
      .update($contacts)
      .set(contact)
      .where(eq($contacts.id, contact.id));
  },
  ['contacts']
);

export const resetContactAttestations = createWriteQuery(
  'resetContactAttestations',
  async (
    {
      contactId,
      attestations,
    }: { contactId: string; attestations?: ContactAttestation[] | null },
    ctx: QueryCtx
  ) => {
    if (attestations?.length) {
      await ctx.db.delete($attestations).where(
        and(
          notInArray(
            $attestations.id,
            attestations.map((a) => a.attestationId)
          ),
          eq($attestations.contactId, contactId)
        )
      );
      await ctx.db
        .insert($attestations)
        .values(attestations.map((a) => a.attestation as Attestation))
        .onConflictDoNothing();
      await ctx.db
        .insert($contactAttestations)
        .values(attestations)
        .onConflictDoNothing();
    } else {
      await ctx.db
        .delete($contactAttestations)
        .where(eq($contactAttestations.contactId, contactId));
    }
  },
  ['contactAttestations']
);

export const upsertContact = createWriteQuery(
  'upsertContact',
  async (contact: Contact, ctx: QueryCtx) => {
    await withTransactionCtx(ctx, async (txCtx) => {
      const existingContact = await ctx.db.query.contacts.findFirst({
        where: (contacts, { eq }) => eq(contacts.id, contact.id),
      });

      if (existingContact) {
        await ctx.db
          .update($contacts)
          .set(contact)
          .where(eq($contacts.id, contact.id));
      } else {
        // for new inserts, default to non contact if unspecified
        const newContact: Contact = {
          ...contact,
          isContact:
            contact.isContact !== undefined ? contact.isContact : false,
        };
        await ctx.db.insert($contacts).values(newContact);
      }

      await resetContactAttestations(
        { contactId: contact.id, attestations: contact.attestations },
        txCtx
      );
    });
  },
  ['contacts', 'contactAttestations']
);

export const getUserContacts = createReadQuery(
  'getUserContacts',
  async (ctx: QueryCtx) => {
    return ctx.db.query.contacts.findMany({
      where: and(eq($contacts.isContact, true)),
      with: {
        pinnedGroups: {
          with: {
            group: true,
          },
        },
        attestations: {
          with: {
            attestation: true,
          },
        },
      },
    });
  },
  ['contacts']
);

export const getSuggestedContacts = createReadQuery(
  'getSuggestedContacts',
  async (ctx: QueryCtx) => {
    const currentUserId = getCurrentUserId();
    return ctx.db.query.contacts.findMany({
      where: and(
        eq($contacts.isContact, false),
        eq($contacts.isContactSuggestion, true),
        not(eq($contacts.id, currentUserId))
      ),
      with: {
        pinnedGroups: {
          with: {
            group: true,
          },
        },
      },
    });
  },
  ['contacts']
);

export const addPinnedGroup = createWriteQuery(
  'addPinnedGroup',
  async ({ groupId }: { groupId: string }, ctx: QueryCtx) => {
    const currentUserId = getCurrentUserId();
    return ctx.db.insert($contactGroups).values({
      contactId: currentUserId,
      groupId,
    });
  },
  ['contactGroups', 'contacts']
);

export const removePinnedGroup = createWriteQuery(
  'removePinnedGroup',
  async ({ groupId }: { groupId: string }, ctx: QueryCtx) => {
    const currentUserId = getCurrentUserId();
    return ctx.db.delete($contactGroups).values({
      contactId: currentUserId,
      groupId,
    });
  },
  ['contactGroups', 'contacts']
);

export const setPinnedGroups = createWriteQuery(
  'setPinnedGroups',
  async ({ groupIds }: { groupIds: string[] }, ctx: QueryCtx) => {
    const currentUserId = getCurrentUserId();
    await ctx.db
      .delete($contactGroups)
      .where(eq($contactGroups.contactId, currentUserId));

    if (groupIds.length !== 0) {
      const newGroups = groupIds.map((groupId) => ({
        contactId: currentUserId,
        groupId,
      }));
      await ctx.db.insert($contactGroups).values(newGroups);
    }
  },
  ['contactGroups', 'contacts']
);

export const insertContact = createWriteQuery(
  'insertContact',
  async (contact: Contact, ctx: QueryCtx) => {
    await withTransactionCtx(ctx, async (txCtx) => {
      await txCtx.db
        .insert($contacts)
        .values(contact)
        .onConflictDoUpdate({
          target: $contacts.id,
          set: conflictUpdateSetAll($contacts),
        });

      await resetContactAttestations(
        { contactId: contact.id, attestations: contact.attestations },
        txCtx
      );
    });
  },
  ['contacts']
);

export const insertContacts = createWriteQuery(
  'insertContacts',
  async (contactsData: Contact[], ctx: QueryCtx) => {
    const currentUserId = getCurrentUserId();
    if (contactsData.length === 0) {
      return;
    }

    const contactGroups = contactsData.flatMap(
      (contact) => contact.pinnedGroups || []
    );

    const contactAttestations = contactsData.flatMap(
      (contact) =>
        contact.attestations?.filter(
          (a) => a.attestation && a.contactId !== currentUserId
        ) || []
    );

    const targetGroups = contactGroups.map((g): Group => {
      const { host: hostUserId } = parseGroupId(g.groupId);
      return {
        id: g.groupId,
        hostUserId,
        privacy: g.group?.privacy,
        currentUserIsMember: false,
        currentUserIsHost: currentUserId === hostUserId,
      };
    });

    await withTransactionCtx(ctx, async (txCtx) => {
      // Batch size to avoid SQLite variable limits
      const BATCH_SIZE = 100;

      for (let i = 0; i < contactsData.length; i += BATCH_SIZE) {
        const batch = contactsData.slice(i, i + BATCH_SIZE);

        await txCtx.db
          .insert($contacts)
          .values(batch)
          .onConflictDoUpdate({
            target: $contacts.id,
            set: conflictUpdateSetAll($contacts, ['isBlocked']),
          });
      }

      if (targetGroups.length) {
        for (let i = 0; i < targetGroups.length; i += BATCH_SIZE) {
          const batch = targetGroups.slice(i, i + BATCH_SIZE);
          await txCtx.db.insert($groups).values(batch).onConflictDoNothing();
        }
      }
      // TODO: Remove stale pinned groups
      if (contactGroups.length) {
        for (let i = 0; i < contactGroups.length; i += BATCH_SIZE) {
          const batch = contactGroups.slice(i, i + BATCH_SIZE);
          await txCtx.db
            .insert($contactGroups)
            .values(batch)
            .onConflictDoNothing();
        }
      }

      // clear existing
      await txCtx.db
        .delete($attestations)
        .where(not(eq($attestations.contactId, currentUserId)));

      if (contactAttestations.length) {
        const attestationsToInsert = contactAttestations.map(
          (a) => a.attestation as Attestation
        );
        for (let i = 0; i < attestationsToInsert.length; i += BATCH_SIZE) {
          const batch = attestationsToInsert.slice(i, i + BATCH_SIZE);
          await txCtx.db
            .insert($attestations)
            .values(batch)
            .onConflictDoUpdate({
              target: $attestations.id,
              set: conflictUpdateSetAll($attestations),
            });
        }

        for (let i = 0; i < contactAttestations.length; i += BATCH_SIZE) {
          const batch = contactAttestations.slice(i, i + BATCH_SIZE);
          await txCtx.db
            .insert($contactAttestations)
            .values(batch)
            .onConflictDoNothing();
        }
      }
    });
  },
  ['contacts', 'groups', 'contactGroups', 'contactAttestations']
);

export const deleteContact = createWriteQuery(
  'deleteContact',
  async (contactId: string, ctx: QueryCtx) => {
    return ctx.db.delete($contacts).where(eq($contacts.id, contactId));
  },
  ['contacts']
);

export const insertGroupUnreads = createWriteQuery(
  'insertGroupUnreads',
  async (unreads: GroupUnread[], ctx: QueryCtx) => {
    if (!unreads.length) return;
    return ctx.db
      .insert($groupUnreads)
      .values(unreads)
      .onConflictDoUpdate({
        target: [$groupUnreads.groupId],
        set: conflictUpdateSetAll($groupUnreads),
      });
  },
  ['groupUnreads']
);

export const insertBaseUnread = createWriteQuery(
  'insertBaseUnread',
  async (unread: BaseUnread, ctx: QueryCtx) => {
    logger.log('insertBaseUnread', unread);
    return ctx.db.insert($baseUnreads).values([unread]).onConflictDoUpdate({
      target: $baseUnreads.id,
      set: unread,
    });
  },
  ['baseUnreads']
);

export const updateGroupUnreadCount = createWriteQuery(
  'updateGroupUnreadCount',
  async (
    { groupId, decrement }: { groupId: string; decrement: number },
    ctx: QueryCtx
  ) => {
    const existingUnread = await ctx.db.query.groupUnreads.findFirst({
      where: eq($groupUnreads.groupId, groupId),
    });

    if (existingUnread) {
      const existingCount = existingUnread.count ?? 0;
      if (existingCount && existingCount - decrement >= 0) {
        return ctx.db
          .update($groupUnreads)
          .set({ count: existingCount - decrement })
          .where(eq($groupUnreads.groupId, groupId));
      }
    }
  },
  ['groupUnreads']
);

export const clearGroupUnread = createWriteQuery(
  'clearGroupUnread',
  async (groupId: string, ctx: QueryCtx) => {
    return ctx.db
      .update($groupUnreads)
      .set({ notifyCount: 0, count: 0, notify: false })
      .where(eq($groupUnreads.groupId, groupId));
  },
  ['groupUnreads']
);

export const insertChannelUnreads = createWriteQuery(
  'insertChannelUnreads',
  async (unreads: ChannelUnread[], ctx: QueryCtx) => {
    if (!unreads.length) return;

    logger.log('insertChannelUnreads', unreads.length);
    return withTransactionCtx(ctx, async (txCtx) => {
      await txCtx.db
        .insert($channelUnreads)
        .values(unreads)
        .onConflictDoUpdate({
          target: [$channelUnreads.channelId],
          set: conflictUpdateSetAll($channelUnreads),
        });
      const threadUnreads = unreads.flatMap((u) => {
        return u.threadUnreads ?? [];
      });
      if (threadUnreads.length) {
        await txCtx.db
          .insert($threadUnreads)
          .values(threadUnreads)
          .onConflictDoUpdate({
            target: [$threadUnreads.threadId, $threadUnreads.channelId],
            set: conflictUpdateSetAll($channelUnreads),
          });
      }
    });
  },
  ['channelUnreads']
);

export const clearChannelUnread = createWriteQuery(
  'clearChannelUnread',
  async (channelId: string, ctx: QueryCtx) => {
    return ctx.db
      .update($channelUnreads)
      .set({ countWithoutThreads: 0, firstUnreadPostId: null })
      .where(eq($channelUnreads.channelId, channelId));
  },
  ['channelUnreads']
);

export const updateChannelUnreadCount = createWriteQuery(
  'updateGroupUnreadCount',
  async (
    { channelId, decrement }: { channelId: string; decrement: number },
    ctx: QueryCtx
  ) => {
    const existingUnread = await ctx.db.query.channelUnreads.findFirst({
      where: eq($channelUnreads.channelId, channelId),
    });

    if (existingUnread) {
      const existingCount = existingUnread.count ?? 0;
      if (existingCount && existingCount - decrement >= 0) {
        return ctx.db
          .update($channelUnreads)
          .set({ count: existingCount - decrement })
          .where(eq($channelUnreads.channelId, channelId));
      }
    }
  },
  ['groupUnreads']
);

export const insertThreadUnreads = createWriteQuery(
  'insertThreadUnreads',
  async (threadActivity: ThreadUnreadState[], ctx: QueryCtx) => {
    if (!threadActivity.length) return;
    return ctx.db
      .insert($threadUnreads)
      .values(threadActivity)
      .onConflictDoUpdate({
        target: [$threadUnreads.threadId, $threadUnreads.channelId],
        set: conflictUpdateSetAll($threadUnreads),
      });
  },
  ['threadUnreads', 'channelUnreads']
);

export const getThreadUnreadsByChannel = createReadQuery(
  'getThreadUnreadsByChannel',
  async (
    { channelId, excludeRead }: { channelId: string; excludeRead?: boolean },
    ctx: QueryCtx
  ): Promise<ThreadUnreadState[]> => {
    return ctx.db.query.threadUnreads.findMany({
      where: and(
        eq($threadUnreads.channelId, channelId),
        excludeRead ? not(eq($threadUnreads.count, 0)) : undefined
      ),
    });
  },
  ['threadUnreads']
);

export const clearThreadUnread = createWriteQuery(
  'clearThreadUnread',
  async (
    { channelId, threadId }: { channelId: string; threadId: string },
    ctx: QueryCtx
  ) => {
    return ctx.db
      .update($threadUnreads)
      .set({ count: 0, firstUnreadPostId: null })
      .where(
        and(
          eq($threadUnreads.channelId, channelId),
          eq($threadUnreads.threadId, threadId)
        )
      );
  },
  ['threadUnreads']
);

export const clearChannelThreadUnreads = createWriteQuery(
  'clearChannelThreadUnreads',
  async ({ channelId }: { channelId: string }, ctx: QueryCtx) => {
    return ctx.db
      .update($threadUnreads)
      .set({ count: 0, firstUnreadPostId: null })
      .where(eq($threadUnreads.channelId, channelId));
  },
  ['threadUnreads']
);

export const insertActivityEvents = createWriteQuery(
  'insertActivityEvents',
  async (events: ActivityEvent[], ctx: QueryCtx) => {
    const currentUserId = getCurrentUserId();
    if (events.length === 0) return;

    const activityEventChannels = events.flatMap((e) => e.channelId || []);

    const activityEventGroups = events.flatMap(
      (contact) => contact.contactUpdateGroups || []
    );

    const targetGroups = activityEventGroups.map((g): Group => {
      const { host: hostUserId } = parseGroupId(g.groupId);
      return {
        id: g.groupId,
        hostUserId,
        privacy: g.group?.privacy,
        currentUserIsMember: false,
        currentUserIsHost: currentUserId === hostUserId,
      };
    });

    await withTransactionCtx(ctx, async (txCtx) => {
      await txCtx.db
        .insert($activityEvents)
        .values(events)
        .onConflictDoUpdate({
          target: [$activityEvents.id, $activityEvents.bucketId],
          set: conflictUpdateSetAll($activityEvents),
        });

      if (targetGroups.length) {
        await txCtx.db
          .insert($groups)
          .values(targetGroups)
          .onConflictDoNothing();
      }

      if (activityEventGroups.length) {
        await txCtx.db
          .insert($activityEventContactGroups)
          .values(activityEventGroups)
          .onConflictDoNothing();
      }

      if (activityEventChannels.length) {
        await Promise.all(
          activityEventChannels.map((channelId) => {
            return txCtx.db
              .update($channels)
              .set({ currentUserIsMember: true })
              .where(eq($channels.id, channelId));
          })
        );
      }
    });
  },
  ['activityEvents'] // should this have 'channels' as well?
);

export const clearActivityEvents = createWriteQuery(
  'clearActivityEvents',
  async (ctx: QueryCtx) => {
    return ctx.db.delete($activityEvents);
  },
  ['activityEvents']
);

export const getLatestActivityEvent = createReadQuery(
  'getLatestActivityEvent',
  async (ctx: QueryCtx) => {
    return ctx.db.query.activityEvents
      .findFirst({
        orderBy: desc($activityEvents.timestamp),
        where: and(
          eq($activityEvents.shouldNotify, true),
          eq($activityEvents.bucketId, 'all')
        ),
      })
      .then(returnNullIfUndefined);
  },
  ['activityEvents']
);

export const getUnreadUnseenActivityEvents = createReadQuery(
  'getUnreadUnseenActivityEvents',
  async ({ seenMarker }: { seenMarker: number }, ctx: QueryCtx) => {
    return ctx.db
      .select()
      .from($activityEvents)
      .leftJoin(
        $channelUnreads,
        eq($activityEvents.channelId, $channelUnreads.channelId)
      )
      .leftJoin(
        $threadUnreads,
        eq($threadUnreads.threadId, $activityEvents.parentId)
      )
      .leftJoin(
        $groupUnreads,
        eq($activityEvents.groupId, $groupUnreads.groupId)
      )
      .where(
        and(
          gt($activityEvents.timestamp, seenMarker),
          or(
            eq($activityEvents.type, 'contact'),
            and(
              eq($activityEvents.shouldNotify, true),
              or(
                and(
                  eq($activityEvents.type, 'reply'),
                  gt($threadUnreads.count, 0)
                ),
                and(
                  eq($activityEvents.type, 'post'),
                  gt($channelUnreads.count, 0)
                ),
                and(
                  gt($groupUnreads.notifyCount, 0),
                  or(
                    eq($activityEvents.type, 'group-ask'),
                    eq($activityEvents.type, 'flag-post'),
                    eq($activityEvents.type, 'flag-reply')
                  )
                )
              )
            )
          )
        )
      );
  },
  ['activityEvents']
);

export type BucketedActivity = {
  all: ActivityEvent[];
  threads: ActivityEvent[];
  mentions: ActivityEvent[];
};

export const getMentionEvents = createReadQuery(
  'getMentionsPage',
  async (
    {
      startCursor,
      stopCursor,
    }: { startCursor?: number | null; stopCursor?: number | null },
    ctx: QueryCtx
  ) => {
    const resolvedCursor = startCursor ?? Date.now();
    const events = await ctx.db.query.activityEvents.findMany({
      where: and(
        eq($activityEvents.bucketId, 'mentions'),
        lt($activityEvents.timestamp, resolvedCursor),
        gt($activityEvents.timestamp, stopCursor ?? 0)
      ),
      orderBy: desc($activityEvents.timestamp),
      with: {
        group: true,
        post: true,
        channel: {
          with: {
            unread: true,
          },
        },
        parent: {
          with: {
            threadUnread: true,
          },
        },
      },
      limit: !stopCursor ? ACTIVITY_SOURCE_PAGESIZE : undefined,
    });
    return events;
  },
  ['activityEvents']
);

export const getBucketedMentionsPage = async ({
  startCursor,
}: {
  startCursor?: number | null;
}) => {
  const events = await getMentionEvents({ startCursor });
  const sourceEvents = toSourceActivityEvents(events);
  return sourceEvents;
};

export const getBucketedActivityPage = async ({
  startCursor,
  bucket,
  existingSourceIds,
}: {
  startCursor?: number | null;
  bucket: ActivityBucket;
  existingSourceIds: string[];
}): Promise<SourceActivityEvents[]> => {
  if (bucket === 'mentions') {
    return getBucketedMentionsPage({ startCursor });
  }

  return getAllOrRepliesPage({ startCursor, bucket, existingSourceIds });
};

export const getAllOrRepliesPage = createReadQuery(
  'getBucketedActivityPage',
  async (
    {
      startCursor,
      bucket,
      existingSourceIds,
    }: {
      startCursor?: number | null;
      bucket: ActivityBucket;
      existingSourceIds: string[];
    },
    ctx: QueryCtx
  ) => {
    logger.log(
      `getBucketedActivityPage ${bucket} ${startCursor}`,
      existingSourceIds
    );

    const resolvedCursor = startCursor ?? Date.now();

    try {
      // get the first N activity sources where the most recent message
      // is older than the cursor
      const sources = ctx.db
        .selectDistinct({ sourceId: $activityEvents.sourceId })
        .from($activityEvents)
        .where(
          and(
            eq($activityEvents.bucketId, bucket),
            or(
              eq($activityEvents.shouldNotify, true),
              eq($activityEvents.type, 'contact')
            ),
            lt($activityEvents.timestamp, resolvedCursor),
            bucket === 'all'
              ? gt($activityEvents.timestamp, 0) // noop
              : eq($activityEvents.type, 'reply'),
            notInArray($activityEvents.sourceId, [
              'throwsIfEmpty',
              ...existingSourceIds,
            ])
          )
        )
        .orderBy(desc($activityEvents.timestamp))
        .limit(ACTIVITY_SOURCE_PAGESIZE)
        .as('sources');

      // then get all the posts for those sources
      const rankedEvents = ctx.db
        .select({
          id: $activityEvents.id,
          rowNumber:
            sql`ROW_NUMBER() OVER(PARTITION BY ${$activityEvents.sourceId} ORDER BY ${$activityEvents.timestamp} DESC)`.as(
              'rowNumber'
            ),
        })
        .from($activityEvents)
        .where(
          and(
            or(
              eq($activityEvents.shouldNotify, true),
              eq($activityEvents.type, 'contact')
            ),
            eq($activityEvents.bucketId, bucket)
          )
        )
        .innerJoin(sources, eq($activityEvents.sourceId, sources.sourceId))
        .as('rankedEvents');

      // then trim to the newest 6 posts per source
      const limitedEventIds = await ctx.db
        .select({ id: rankedEvents.id })
        .from(rankedEvents)
        .where(lte(rankedEvents.rowNumber, 6));

      let sourceEvents: ActivityEvent[];
      if (limitedEventIds && limitedEventIds.length > 0) {
        const ids = limitedEventIds
          .map((e) => e.id)
          .filter(Boolean) as string[];

        if (ids.length === 0) {
          return [];
        }

        // we should probably try to do this through the main query, but this will suffice
        sourceEvents = await ctx.db.query.activityEvents.findMany({
          where: and(
            inArray($activityEvents.id, ids),
            eq($activityEvents.bucketId, bucket)
          ),
          orderBy: desc($activityEvents.timestamp),
          with: {
            group: {
              with: {
                unread: true,
              },
            },
            post: true,
            channel: {
              with: {
                unread: true,
              },
            },
            parent: {
              with: {
                threadUnread: true,
              },
            },
            groupEventUser: true,
            contactUpdateGroups: {
              with: {
                group: true,
              },
            },
          },
        });
      } else {
        sourceEvents = [];
      }

      let allEvents: ActivityEvent[];
      if (sourceEvents.length === 0) {
        return [];
      } else if (bucket === 'all') {
        // the set of source events doesn't necessarily encompass all mentions,
        // but we need them all to accurately represent an "all" timeline so we
        // grab separately
        const stopCursor = sourceEvents[sourceEvents.length - 1]?.timestamp;
        const mentionEvents = await getMentionEvents({
          startCursor,
          stopCursor,
        });
        allEvents = interleaveActivityEvents(sourceEvents, mentionEvents);
      } else {
        allEvents = sourceEvents;
      }

      const sourceActivity = toSourceActivityEvents(allEvents);
      return sourceActivity;
    } catch (e) {
      logger.error('getBucketedActivityPage query error', e);
      return [];
    }
  },
  ['activityEvents']
);

export const getBucketedActivity = createReadQuery(
  'getActivityEvents',
  async (ctx: QueryCtx): Promise<BucketedActivity> => {
    const allQuery = ctx.db.query.activityEvents.findMany({
      orderBy: desc($activityEvents.timestamp),
      with: {
        group: true,
        channel: true,
        post: true,
        author: true,
        parent: true,
      },
    });

    const threadsQuery = ctx.db.query.activityEvents.findMany({
      where: eq($activityEvents.type, 'reply'),
      orderBy: desc($activityEvents.timestamp),
      with: {
        group: true,
        channel: true,
        post: true,
        author: true,
        parent: true,
      },
    });

    const mentionsQuery = ctx.db.query.activityEvents.findMany({
      where: eq($activityEvents.isMention, true),
      orderBy: desc($activityEvents.timestamp),
      with: {
        group: true,
        channel: true,
        post: {
          with: {
            threadUnread: true,
          },
        },
        author: true,
        parent: true,
      },
    });

    const [all, threads, mentions] = await Promise.all([
      allQuery,
      threadsQuery,
      mentionsQuery,
    ]);
    return { all, threads, mentions };
  },
  ['activityEvents']
);

export const insertPinnedItems = createWriteQuery(
  'insertPinnedItems',
  async (pinnedItems: Pin[], ctx: QueryCtx) => {
    return withTransactionCtx(
      { ...ctx, meta: { ...ctx.meta, label: 'pins' } },
      async (txCtx) => {
        // users may not have pinned items
        if (!pinnedItems.length) return;
        const pinnedItemIds = pinnedItems.map((item) => item.itemId);

        await txCtx.db
          .insert($pins)
          .values(pinnedItems)
          .onConflictDoUpdate({
            target: $pins.itemId,
            set: conflictUpdateSetAll($pins),
          });
        await txCtx.db
          .delete($pins)
          .where(notInArray($pins.itemId, pinnedItemIds));
      }
    );
  },
  ['pins', 'groups']
);

export const insertPinnedItem = createWriteQuery(
  'insertPinnedItem',
  async (
    {
      itemId,
      type,
      index,
    }: {
      itemId: string;
      type: PinType;
      index?: number;
    },
    ctx: QueryCtx
  ) => {
    return withTransactionCtx(ctx, async (txCtx) => {
      const maxResult = await txCtx.db
        .select({ value: max($pins.index) })
        .from($pins);
      const maxIndex = maxResult[0]?.value ?? 0;
      await txCtx.db
        .insert($pins)
        .values({ itemId, type, index: index ?? maxIndex + 1 });
    });
  },
  ['pins', 'groups', 'channels']
);

export const deletePinnedItem = createWriteQuery(
  'deletePinnedItem',
  async ({ itemId }: { itemId: string }, ctx: QueryCtx) => {
    return ctx.db.delete($pins).where(eq($pins.itemId, itemId));
  },
  ['pins', 'groups', 'channels']
);

export const getPinnedItems = createReadQuery(
  'getPinnedItems',
  async (ctx: QueryCtx) => {
    return ctx.db.query.pins.findMany({});
  },
  ['pins']
);

export const getGroupRole = createReadQuery(
  'getGroupRole',
  async (
    { groupId, roleId }: { groupId: string; roleId: string },
    ctx: QueryCtx
  ) => {
    return ctx.db.query.groupRoles.findFirst({
      where: and(eq($groupRoles.groupId, groupId), eq($groupRoles.id, roleId)),
    });
  },
  ['groupRoles']
);

export const getGroupRoles = createReadQuery(
  'getGroupRoles',
  async ({ groupId }: { groupId: string }, ctx: QueryCtx) => {
    return ctx.db.query.groupRoles.findMany({
      where: eq($groupRoles.groupId, groupId),
    });
  },
  ['groupRoles']
);

export const addGroupRole = createWriteQuery(
  'addGroupRole',
  async (
    {
      groupId,
      roleId,
      meta,
    }: { groupId: string; roleId: string; meta?: ClientMeta },
    ctx: QueryCtx
  ) => {
    return ctx.db
      .insert($groupRoles)
      .values({ groupId, id: roleId, ...meta })
      .onConflictDoNothing();
  },
  ['groupRoles']
);

export const deleteGroupRole = createWriteQuery(
  'deleteGroupRole',
  async ({ groupId, roleId }: { groupId: string; roleId: string }, ctx) => {
    return ctx.db
      .delete($groupRoles)
      .where(and(eq($groupRoles.groupId, groupId), eq($groupRoles.id, roleId)));
  },
  ['groupRoles']
);

export const updateGroupRole = createWriteQuery(
  'updateGroupRole',
  async (
    {
      groupId,
      roleId,
      meta,
    }: { groupId: string; roleId: string; meta: ClientMeta },
    ctx: QueryCtx
  ) => {
    return ctx.db
      .update($groupRoles)
      .set(meta)
      .where(and(eq($groupRoles.groupId, groupId), eq($groupRoles.id, roleId)));
  },
  ['groupRoles']
);

export const addMembersToRole = createWriteQuery(
  'addMembersToRole',
  async (
    {
      groupId,
      roleId,
      contactIds,
    }: { groupId: string; roleId: string; contactIds: string[] },
    ctx: QueryCtx
  ) => {
    return ctx.db
      .insert($chatMemberGroupRoles)
      .values(
        contactIds.map((contactId) => ({
          groupId,
          roleId,
          contactId,
        }))
      )
      .onConflictDoNothing();
  },
  ['chatMemberGroupRoles', 'groupRoles']
);

export const removeMembersFromRole = createWriteQuery(
  'removeMembersFromRole',
  async (
    {
      groupId,
      roleId,
      contactIds,
    }: { groupId: string; roleId: string; contactIds: string[] },
    ctx: QueryCtx
  ) => {
    return ctx.db
      .delete($chatMemberGroupRoles)
      .where(
        and(
          eq($chatMemberGroupRoles.groupId, groupId),
          eq($chatMemberGroupRoles.roleId, roleId),
          inArray($chatMemberGroupRoles.contactId, contactIds)
        )
      );
  },
  ['chatMemberGroupRoles', 'groupRoles']
);

// Helpers

function allQueryColumns<T extends Subquery>(
  subquery: T
): T['_']['selectedFields'] {
  return subquery._.selectedFields;
}

function conflictUpdateSetAll(table: Table, exclude?: string[]) {
  const columns = getTableColumns(table);
  return conflictUpdateSet(
    ...Object.entries(columns)
      .filter(([k]) => !exclude?.includes(k))
      .filter(([_, c]) => c.generated === undefined)
      .map(([_, v]) => v)
  );
}

function conflictUpdateSet(...columns: Column[]) {
  return Object.fromEntries(
    columns.map((c) => {
      return [getColumnTsName(c), sql.raw(`excluded.${c.name}`)];
    })
  );
}

function getColumnTsName(c: Column) {
  const name = Object.keys(c.table).find(
    (k) => c.table[k as keyof typeof c.table] === c
  );
  if (!name) {
    throw new Error('unable to find column name');
  }
  return name;
}

function ascNullsLast(column: SQLWrapper | AnyColumn) {
  return sql`${column} ASC NULLS LAST`;
}

function returnNullIfUndefined<T>(input: T | undefined): T | null {
  return input ?? null;
}
