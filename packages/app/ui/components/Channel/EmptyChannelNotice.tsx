import * as db from '@tloncorp/shared/db';
import { defaultTemplateChannelTitles } from '@tloncorp/shared/domain';
import * as logic from '@tloncorp/shared/logic';
import { Button, LoadingSpinner, Text } from '@tloncorp/ui';
import { useEffect, useMemo, useState } from 'react';
import { YStack, styled } from 'tamagui';

import { useChatOptions } from '../../contexts/chatOptions';
import { useGroup } from '../../contexts/groups';
import { useChatTitle, useIsAdmin } from '../../utils';
import WayfindingNotice from '../Wayfinding/Notices';

/**
 * How long a newly created agent group keeps its empty-channel notice
 * suppressed while waiting for the agent's opening message. Generous — the
 * bot has to accept the invite, sync the group and take a turn — but not
 * unbounded, since past it the owner needs the ordinary recovery actions
 * back rather than a permanently blank channel.
 */
const AGENT_OPENING_GRACE_MS = 5 * 60 * 1000;

export function EmptyChannelNotice({
  channel,
  userId,
  isLoading,
  loadPostsError,
  onPressRetryLoad,
  isAdmin: isAdminOverride,
}: {
  channel: db.Channel;
  userId: string;
  isLoading: boolean;
  loadPostsError?: Error | null;
  onPressRetryLoad?: () => void;
  isAdmin?: boolean;
}) {
  const {
    onPressInvite,
    onPressGroupMeta,
    onPressChannelMeta,
    onPressChatDetails,
  } = useChatOptions();
  const group = useGroup(channel.groupId ?? '');
  const { value: agentGroupAgents, isLoading: agentRecordsLoading } =
    db.agentGroupAgents.useStorageItem();
  const { value: onboardingGroupId, isLoading: markerLoading } =
    db.agentOnboardingGroupId.useStorageItem();
  const { value: agentGroupOpenedAt, isLoading: openedAtLoading } =
    db.agentGroupOpenedAt.useStorageItem();
  const isGroupAdminFromHook = useIsAdmin(channel.groupId ?? '', userId);
  const isGroupAdmin = isAdminOverride ?? isGroupAdminFromHook;
  const isDefaultPersonalChannel = useMemo(() => {
    return logic.isDefaultPersonalChannel(channel, userId);
  }, [channel, userId]);

  const isSingleChannelGroup = (group?.channels?.length ?? 0) <= 1;
  const title = useChatTitle(channel, group);
  const displayTitle =
    !title || title === 'Untitled group' ? 'your group' : title;
  const headingTitle = useMemo(() => {
    if (channel.type === 'dm') return 'your direct message';
    if (!title || title === 'Untitled group') return 'your group';
    if (
      !isSingleChannelGroup &&
      group?.title &&
      defaultTemplateChannelTitles.has(title)
    ) {
      return `${group.title}'s ${title}`;
    }
    return title;
  }, [channel.type, title, isSingleChannelGroup, group?.title]);
  const memberCount = group?.members?.length ?? group?.memberCount ?? 0;
  const roleCount = group?.roles?.length ?? 0;
  const memberText = memberCount === 1 ? '1 Member' : `${memberCount} Members`;
  const roleText = roleCount === 1 ? '1 Role' : `${roleCount} Roles`;

  const subtitle = useMemo(() => {
    const name = displayTitle;
    if (channel.type === 'dm') {
      return `You're speaking directly with ${title ?? 'someone'}.`;
    }
    if (channel.type === 'groupDm') {
      return `This is the start of this group conversation.`;
    }
    if (isSingleChannelGroup) {
      return `This is the start of ${name}.`;
    }
    const privacy = group?.privacy;
    if (privacy) {
      return `This is the start of the ${privacy} ${name} channel.`;
    }
    return `This is the start of the ${name} channel.`;
  }, [channel.type, isSingleChannelGroup, group?.privacy, displayTitle, title]);

  const TitleText = styled(Text, {
    fontSize: '$xl',
    fontWeight: '600',
    color: '$primaryText',
  });

  // A newly created agent group opens on an empty chat for only the seconds
  // before the agent's introduction lands, and the welcome notice actively
  // fights that handoff — "Invite people" and "Edit group" are exactly what
  // the guided setup does for you. While the group is still one channel and
  // the client knows it seated an agent there, show nothing and let the
  // agent speak first. Channels created after that (the group has grown) get
  // the normal notice.
  //
  // Accounts without a Tlonbot can never hit this: both records below are
  // written only by the agent flows, which are gated on the bot existing —
  // for everyone else these are empty and every group behaves as before.
  //
  // While those records are still hydrating they read as their defaults,
  // which would flash the Invite/Edit actions in a guided group restored
  // cold — so any single-channel chat group holds the notice until they
  // load. For everyone else that's a beat of blank on a rare cold start
  // that lands directly in an empty channel.
  const couldBeAgentOpening =
    channel.type === 'chat' &&
    !!channel.groupId &&
    (group?.channels?.length ?? 0) <= 1;
  // The recorded agent says who speaks for the group, which never stops
  // being true — on its own it hid the admin's Invite and Edit actions for
  // good when the invite, the join or the opening quietly failed, on the
  // very screen where the owner would go looking for them. So it only
  // suppresses while the opening is still plausibly in flight: an active
  // onboarding marker, or an opening stamped within the last few minutes.
  // Past that the group is treated as one whose agent is not coming, and
  // the ordinary recovery actions come back.
  const openedAt = channel.groupId
    ? agentGroupOpenedAt[channel.groupId]
    : undefined;
  // Nothing else will re-render this when the grace runs out. An owner
  // watching an empty channel for a failed opening is exactly the person
  // who needs the controls back, and they are also the person least likely
  // to generate the incidental state change that would otherwise recompute
  // this. So wake up once, when the window actually closes.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (openedAt == null) {
      return;
    }
    const remaining = openedAt + AGENT_OPENING_GRACE_MS - Date.now();
    if (remaining <= 0) {
      return;
    }
    const timer = setTimeout(() => setNow(Date.now()), remaining);
    return () => clearTimeout(timer);
  }, [openedAt]);
  const openingIsRecent =
    openedAt != null && now - openedAt < AGENT_OPENING_GRACE_MS;
  const isActiveOnboardingGroup = onboardingGroupId === channel.groupId;
  const awaitingAgentOpening =
    couldBeAgentOpening &&
    (agentRecordsLoading ||
      markerLoading ||
      openedAtLoading ||
      isActiveOnboardingGroup ||
      (openingIsRecent && agentGroupAgents[channel.groupId!] != null));

  if (isDefaultPersonalChannel) {
    return <WayfindingNotice.EmptyChannel channel={channel} />;
  }

  if (isLoading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center">
        <LoadingSpinner />
      </YStack>
    );
  }

  if (loadPostsError) {
    return (
      <YStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        gap="$xl"
        paddingBottom="$2xl"
      >
        <YStack gap="$s" alignItems="center">
          <Text color="$tertiaryText">Failed to load posts</Text>
          <Text color="$tertiaryText" size="$label/s">
            Error: {loadPostsError.message}
          </Text>
        </YStack>
        <Button
          preset="outline"
          size="small"
          onPress={onPressRetryLoad}
          label="Retry"
        />
      </YStack>
    );
  }

  // Below the loading/error branches on purpose: this only suppresses the
  // welcome notice once the post query has actually resolved empty. Winning
  // earlier would swallow the spinner and the retry escape hatch — on the
  // first-run locked route the header is hidden too, leaving a silent blank
  // screen with no way out.
  if (awaitingAgentOpening) {
    return null;
  }

  const isBoxedLayout =
    channel.type === 'notebook' || channel.type === 'gallery';

  const noticeContent = (
    <>
      <YStack gap="$m">
        <TitleText>🌱 Welcome to {headingTitle}!</TitleText>
        <Text size="$body" color="$secondaryText">
          {subtitle}
        </Text>
      </YStack>
      {isGroupAdmin && (
        <YStack gap="$xl" alignItems="flex-start">
          <Button
            fill="text"
            intent="positive"
            label="Invite people"
            testID="EmptyChannelInviteButton"
            onPress={onPressInvite}
          />
          <Button
            fill="text"
            intent="positive"
            label={isSingleChannelGroup ? 'Edit group' : 'Edit channel'}
            testID={
              isSingleChannelGroup
                ? 'EmptyChannelEditGroupButton'
                : 'EmptyChannelEditChannelButton'
            }
            onPress={
              isSingleChannelGroup
                ? () => onPressGroupMeta(true)
                : onPressChannelMeta
            }
          />
          <Button
            preset="secondaryOutline"
            label={`${memberText} · ${roleText}`}
            leadingIcon={'Settings'}
            trailingIcon={'ChevronRight'}
            onPress={() =>
              channel.groupId &&
              onPressChatDetails({ type: 'group', id: channel.groupId })
            }
          />
        </YStack>
      )}
    </>
  );

  if (isBoxedLayout) {
    return (
      <YStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        marginHorizontal={'$xl'}
      >
        <YStack width="100%" maxWidth={400} padding="$2xl" gap="$2xl">
          {noticeContent}
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack
      flex={1}
      justifyContent="flex-end"
      paddingHorizontal="$xl"
      paddingVertical="$2xl"
    >
      <YStack gap="$2xl" paddingBottom="$2xl" paddingLeft="$xl">
        {noticeContent}
      </YStack>
    </YStack>
  );
}
