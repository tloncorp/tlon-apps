import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as api from '@tloncorp/api';
import { createDevLogger } from '@tloncorp/shared';
import {
  Button,
  ConfirmDialog,
  LoadingSpinner,
  Text,
  useIsWindowNarrow,
} from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, XStack, YStack } from 'tamagui';

import { RootStackParamList } from '../../navigation/types';
import {
  ScreenHeader,
  SettingsContentScrollView,
  Tabs,
  TextInput,
} from '../../ui';
import {
  BotSettingsDivider,
  BotSettingsErrorText,
  BotSettingsRow,
  BotSettingsSection,
} from './bot/BotSettingsUI';
import { BASIC_PROVIDER_ID, providerLabel } from './bot/constants';
import {
  ChannelRuleDraft,
  formatChannelHost,
  getErrorMessage,
  getGroupChannelRuleKeys,
  groupChannelEntries,
  resolveGroupFull,
} from './bot/helpers';
import {
  useBotGroupMembership,
  useBotSettingsQueries,
} from './bot/useBotSettingsData';
import {
  useBotSettingsDraft,
  useSyncBotSettingsDraft,
} from './bot/useBotSettingsDraft';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'BotChannelRulesSettings'
>;

const logger = createDevLogger('BotChannelRulesScreen', false);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Group joins are eventually consistent; poll membership after a join until the
// group shows up (~15s worst case) before giving up.
const JOIN_MEMBERSHIP_POLL_ATTEMPTS = 8;
const JOIN_MEMBERSHIP_POLL_INTERVAL_MS = 2000;

const ruleChanged = (
  current: ChannelRuleDraft | undefined,
  initial: ChannelRuleDraft | undefined
): boolean =>
  JSON.stringify(current ?? null) !== JSON.stringify(initial ?? null);

export function BotChannelRulesScreen(props: Props) {
  const isWindowNarrow = useIsWindowNarrow();
  const queries = useBotSettingsQueries();
  // Sync the draft from the server before editing so reaching this screen
  // directly (cold launch / deep link) doesn't start from an empty draft and
  // wipe existing chat settings on save. Gate edits on `initialized`.
  useSyncBotSettingsDraft(queries);
  const draft = useBotSettingsDraft();
  // Also require the draft to be scoped to the current ship so a previous
  // account's initialized draft isn't treated as ready after switching.
  const ready = draft.initialized && draft.scopeKey === queries.ship;
  const [search, setSearch] = useState('');
  const [enabledOnly, setEnabledOnly] = useState(false);
  const [joiningGroups, setJoiningGroups] = useState<Record<string, boolean>>(
    {}
  );
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinTarget, setJoinTarget] = useState<{
    groupHost: string;
    groupName: string;
    sampleChannelKey: string;
    label: string;
  } | null>(null);
  const [disableEverywhereSnapshot, setDisableEverywhereSnapshot] =
    useState<Record<string, ChannelRuleDraft> | null>(null);
  const drafts = draft.draft.chat.channelRuleDrafts;
  const baselineDrafts = draft.baseline.chat.channelRuleDrafts;
  const channelsData = queries.channelsQuery.data;
  const rawGroups = useMemo(() => channelsData ?? {}, [channelsData]);

  const groups = useMemo(
    () => groupChannelEntries(rawGroups, drafts),
    [rawGroups, drafts]
  );
  // Rules, saved or pending, are what a departure would leave stale. Check a
  // group's full rule set, not the search/enabled filtered rows: a rule on a
  // hidden channel still counts.
  const groupHasRules = useCallback(
    (host: string, group: string) =>
      getGroupChannelRuleKeys(rawGroups, host, group, baselineDrafts).length >
        0 || getGroupChannelRuleKeys(rawGroups, host, group, drafts).length > 0,
    [rawGroups, baselineDrafts, drafts]
  );
  // Confirm those groups' membership against their full rosters.
  const groupIdsWithRules = useMemo(
    () =>
      groups
        .filter(
          (group) =>
            group.group !== 'unknown' && groupHasRules(group.host, group.group)
        )
        .map((group) => `${formatChannelHost(group.host)}/${group.group}`),
    [groups, groupHasRules]
  );
  const { getMembership, refreshMembership } = useBotGroupMembership(
    queries,
    groupIdsWithRules
  );

  const filteredGroups = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return groups
      .map((group) => {
        // A departed group keeps its saved channels on the Enabled tab even
        // once cleared, so its Undo stays in reach.
        const departed =
          group.group !== 'unknown' &&
          getMembership(
            group.host,
            group.group,
            groupHasRules(group.host, group.group)
          ) === 'departed';
        return {
          ...group,
          channels: group.channels.filter((channel) => {
            if (
              enabledOnly &&
              !drafts[channel.key] &&
              !(departed && baselineDrafts[channel.key])
            ) {
              return false;
            }
            if (!normalizedSearch) return true;
            return (
              channel.label.toLowerCase().includes(normalizedSearch) ||
              channel.key.toLowerCase().includes(normalizedSearch) ||
              (group.title || group.group)
                .toLowerCase()
                .includes(normalizedSearch)
            );
          }),
        };
      })
      .filter((group) => group.channels.length > 0);
  }, [
    groups,
    drafts,
    baselineDrafts,
    search,
    enabledOnly,
    getMembership,
    groupHasRules,
  ]);

  const enabledChannelCount = Object.keys(drafts).length;
  const allChannelsDisabled = enabledChannelCount === 0;
  const canUndoDisableEverywhere =
    allChannelsDisabled &&
    Boolean(
      disableEverywhereSnapshot &&
      Object.keys(disableEverywhereSnapshot).length > 0
    );

  useEffect(() => {
    if (!allChannelsDisabled) setDisableEverywhereSnapshot(null);
  }, [allChannelsDisabled]);

  // Clear ship-scoped local state when the ship changes (desktop drawer keeps
  // this screen mounted across account switches): the disable-everywhere
  // snapshot holds the previous ship's rules, and a pending join confirmation
  // (joinTarget) points at the previous ship's group — confirming it after a
  // switch would join that group from the new account.
  useEffect(() => {
    setDisableEverywhereSnapshot(null);
    setJoinTarget(null);
    setJoinError(null);
    setJoiningGroups({});
  }, [queries.ship]);

  const replaceDrafts = useCallback(
    (channelRuleDrafts: Record<string, ChannelRuleDraft>) => {
      if (!ready) return;
      draft.commitDraft((current) => ({
        ...current,
        chat: { ...current.chat, channelRuleDrafts },
      }));
    },
    [draft, ready]
  );

  // Clearing a departed group's rules is a draft edit like any other, so the
  // user can still undo it (restoring the saved rules) until they apply.
  const handleClearGroupRulesToggle = useCallback(
    (host: string, group: string) => {
      const draftKeys = getGroupChannelRuleKeys(rawGroups, host, group, drafts);
      if (draftKeys.length > 0) {
        const channelRuleDrafts = { ...drafts };
        draftKeys.forEach((key) => delete channelRuleDrafts[key]);
        replaceDrafts(channelRuleDrafts);
        return;
      }
      const savedRules = Object.fromEntries(
        getGroupChannelRuleKeys(rawGroups, host, group, baselineDrafts).map(
          (key) => [key, baselineDrafts[key]]
        )
      );
      replaceDrafts({ ...drafts, ...savedRules });
    },
    [rawGroups, drafts, baselineDrafts, replaceDrafts]
  );

  const handleDisableEverywhereToggle = useCallback(() => {
    if (canUndoDisableEverywhere && disableEverywhereSnapshot) {
      replaceDrafts(disableEverywhereSnapshot);
      setDisableEverywhereSnapshot(null);
      return;
    }
    setDisableEverywhereSnapshot(drafts);
    replaceDrafts({});
  }, [
    canUndoDisableEverywhere,
    disableEverywhereSnapshot,
    drafts,
    replaceDrafts,
  ]);

  const handleJoinGroup = useCallback(
    async (groupHost: string, groupName: string, sampleChannelKey: string) => {
      setJoinError(null);
      if (!queries.moon) {
        setJoinError('Tlonbot moon is not ready yet.');
        return;
      }
      const groupFull = resolveGroupFull(
        rawGroups,
        groupHost,
        groupName,
        sampleChannelKey
      );
      if (!groupFull) {
        setJoinError('Could not find this group.');
        return;
      }
      const groupKey = `${groupHost}/${groupName}`;
      setJoiningGroups((prev) => ({ ...prev, [groupKey]: true }));
      try {
        try {
          await api.addTlawnToCordon(queries.ship, groupFull, queries.moon);
        } catch (error) {
          // Cordon add is best-effort: it fails when the moon is already
          // allowed. The join below is what must succeed.
          logger.trackError('Failed to add Tlonbot moon to cordon', { error });
        }
        await sleep(1500);
        await api.joinTlawnGroup(queries.ship, groupFull, queries.moon);
        // The join is eventually consistent: neither the group roster nor the
        // moon's listing is guaranteed to show the new group on the first
        // read, and moonChannelsQuery stops polling once it has data. Poll the
        // same membership check the rows use until it registers (or we give
        // up), keeping the "Joining…" state meanwhile.
        for (
          let attempt = 0;
          attempt < JOIN_MEMBERSHIP_POLL_ATTEMPTS;
          attempt++
        ) {
          const membership = await refreshMembership(groupFull);
          if (membership(groupHost, groupName, false) === 'member') {
            break;
          }
          await sleep(JOIN_MEMBERSHIP_POLL_INTERVAL_MS);
        }
      } catch (error) {
        setJoinError(getErrorMessage(error) ?? 'Failed to join this group.');
      } finally {
        setJoiningGroups((prev) => ({ ...prev, [groupKey]: false }));
      }
    },
    [queries, rawGroups, refreshMembership]
  );

  // Gate only on the initial load: channelsQuery polls while the bot is
  // starting, and swapping the list for a spinner on every background
  // refetch would discard the rendered tree (and scroll position) each poll.
  const loading = queries.channelsQuery.isLoading;

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        borderBottom
        backAction={
          isWindowNarrow ? () => props.navigation.goBack() : undefined
        }
        title="Channel rules"
        placement="navigation"
      />
      {!ready ? (
        <View flex={1} alignItems="center" justifyContent="center">
          <LoadingSpinner />
        </View>
      ) : (
        <SettingsContentScrollView
          paddingHorizontal="$l"
          paddingTop="$l"
          safeAreaBottomOffset={24}
        >
          <YStack gap="$l" paddingBottom="$2xl">
            <TextInput
              icon="Search"
              placeholder="Filter by name"
              value={search}
              onChangeText={setSearch}
              spellCheck={false}
              autoCorrect={false}
              autoCapitalize="none"
              rightControls={
                search !== '' ? (
                  <TextInput.InnerButton
                    label="Clear"
                    onPress={() => setSearch('')}
                  />
                ) : undefined
              }
            />
            <Tabs>
              <Tabs.Tab
                name="all"
                activeTab={enabledOnly ? 'enabled' : 'all'}
                onTabPress={() => setEnabledOnly(false)}
              >
                <Tabs.Title cursor="pointer" active={!enabledOnly}>
                  All
                </Tabs.Title>
              </Tabs.Tab>
              <Tabs.Tab
                name="enabled"
                activeTab={enabledOnly ? 'enabled' : 'all'}
                onTabPress={() => setEnabledOnly(true)}
              >
                <Tabs.Title cursor="pointer" active={enabledOnly}>
                  Enabled
                </Tabs.Title>
              </Tabs.Tab>
            </Tabs>

            {enabledOnly ? (
              <BotSettingsSection>
                <XStack
                  minHeight={56}
                  alignItems="center"
                  gap="$l"
                  paddingHorizontal="$l"
                  paddingVertical="$m"
                >
                  <YStack flex={1} minWidth={0} gap="$l">
                    <Text size="$label/l" color="$primaryText">
                      Disable everywhere
                    </Text>
                    <Text size="$label/s" color="$secondaryText">
                      {canUndoDisableEverywhere
                        ? 'Restore the channels that were previously enabled'
                        : allChannelsDisabled
                          ? 'No channels are enabled'
                          : `Turn off ${enabledChannelCount} enabled ${
                              enabledChannelCount === 1 ? 'channel' : 'channels'
                            }`}
                    </Text>
                  </YStack>
                  <Button
                    preset={
                      canUndoDisableEverywhere
                        ? 'secondaryOutline'
                        : 'destructive'
                    }
                    size="small"
                    label={canUndoDisableEverywhere ? 'Undo' : 'Disable all'}
                    disabled={!canUndoDisableEverywhere && allChannelsDisabled}
                    onPress={handleDisableEverywhereToggle}
                  />
                </XStack>
              </BotSettingsSection>
            ) : null}

            <BotSettingsErrorText>{joinError}</BotSettingsErrorText>

            {loading ? (
              <YStack alignItems="center" gap="$m" paddingVertical="$2xl">
                <LoadingSpinner />
                <Text size="$label/m" color="$secondaryText">
                  Loading channels…
                </Text>
              </YStack>
            ) : filteredGroups.length === 0 ? (
              <Text
                size="$label/m"
                color="$secondaryText"
                paddingHorizontal="$s"
              >
                {groups.length === 0
                  ? 'No channels found on this node yet.'
                  : enabledOnly
                    ? 'No enabled channels.'
                    : 'No channels match.'}
              </Text>
            ) : (
              filteredGroups.map((group) => {
                const groupKey = `${group.host}/${group.group}`;
                const isUnknownGroup = group.group === 'unknown';
                const membership = isUnknownGroup
                  ? 'not-member'
                  : getMembership(
                      group.host,
                      group.group,
                      groupHasRules(group.host, group.group)
                    );
                const isGroupMember = membership === 'member';
                const isDeparted = membership === 'departed';
                const canJoinGroup =
                  (membership === 'not-member' || isDeparted) &&
                  !isUnknownGroup &&
                  Boolean(queries.ship) &&
                  Boolean(queries.moon);
                const isJoining = Boolean(joiningGroups[groupKey]);
                const groupLabel = group.title || group.group;
                const enabledCount = group.channels.filter((channel) =>
                  Boolean(drafts[channel.key])
                ).length;
                const hasDraftRules =
                  isDeparted &&
                  getGroupChannelRuleKeys(
                    rawGroups,
                    group.host,
                    group.group,
                    drafts
                  ).length > 0;

                return (
                  <YStack key={groupKey} gap="$m">
                    <XStack
                      alignItems="center"
                      justifyContent="space-between"
                      gap="$l"
                      paddingHorizontal="$s"
                    >
                      <YStack flex={1} minWidth={0} gap="$l">
                        <Text
                          size="$label/l"
                          fontWeight="500"
                          color="$primaryText"
                          numberOfLines={1}
                        >
                          {groupLabel}
                        </Text>
                        <Text
                          size="$label/s"
                          color="$secondaryText"
                          numberOfLines={1}
                        >
                          {formatChannelHost(group.host)}/{group.group}
                        </Text>
                      </YStack>
                      {!isGroupMember ? (
                        <Button
                          preset="secondaryOutline"
                          size="small"
                          label={isJoining ? 'Joining…' : 'Join'}
                          disabled={isJoining || !canJoinGroup}
                          onPress={() =>
                            setJoinTarget({
                              groupHost: group.host,
                              groupName: group.group,
                              sampleChannelKey: group.channels[0]?.key ?? '',
                              label: groupLabel,
                            })
                          }
                        />
                      ) : (
                        <Text size="$label/s" color="$secondaryText">
                          {enabledCount}/{group.channels.length} enabled
                        </Text>
                      )}
                    </XStack>
                    <BotSettingsSection>
                      {isDeparted ? (
                        <>
                          <XStack
                            minHeight={56}
                            alignItems="center"
                            gap="$l"
                            paddingHorizontal="$l"
                            paddingVertical="$m"
                          >
                            <YStack flex={1} minWidth={0} gap="$l">
                              <Text size="$label/l" color="$primaryText">
                                Tlonbot is no longer in this group
                              </Text>
                              <Text size="$label/s" color="$secondaryText">
                                {hasDraftRules
                                  ? 'Its rules here are paused. Join again to resume them.'
                                  : 'Its rules here will be removed when you apply.'}
                              </Text>
                            </YStack>
                            <Button
                              preset={
                                hasDraftRules
                                  ? 'destructive'
                                  : 'secondaryOutline'
                              }
                              size="small"
                              label={hasDraftRules ? 'Clear rules' : 'Undo'}
                              onPress={() =>
                                handleClearGroupRulesToggle(
                                  group.host,
                                  group.group
                                )
                              }
                            />
                          </XStack>
                          <BotSettingsDivider />
                        </>
                      ) : null}
                      {group.channels.map((channel, index) => {
                        const rule = drafts[channel.key];
                        const pending = ruleChanged(
                          rule,
                          baselineDrafts[channel.key]
                        );
                        const isEnabled = Boolean(rule);
                        const accessLabel =
                          rule?.mode === 'allowlist' ? 'Allowlist' : 'Open';
                        const modelLabel = rule?.modelOverrideProvider
                          ? rule.modelOverrideProvider === BASIC_PROVIDER_ID
                            ? 'Basic'
                            : providerLabel(rule.modelOverrideProvider)
                          : 'Default';

                        return (
                          <YStack key={channel.key}>
                            <BotSettingsRow
                              label={channel.label}
                              description={channel.key}
                              value={
                                !isEnabled
                                  ? 'Off'
                                  : isDeparted
                                    ? 'Paused'
                                    : modelLabel === 'Default'
                                      ? accessLabel
                                      : `${accessLabel} · ${modelLabel}`
                              }
                              pending={pending}
                              // Only block navigation when membership is truly
                              // unknown. A group already resolved as a member
                              // stays editable even while the moon listing
                              // loads/errors.
                              disabled={membership === 'unknown'}
                              onPress={() =>
                                props.navigation.navigate(
                                  'BotChannelRuleSettings',
                                  {
                                    channelKey: channel.key,
                                    channelLabel: channel.label,
                                    groupJoined:
                                      isUnknownGroup || isGroupMember,
                                  }
                                )
                              }
                            />
                            {index < group.channels.length - 1 ? (
                              <BotSettingsDivider />
                            ) : null}
                          </YStack>
                        );
                      })}
                    </BotSettingsSection>
                  </YStack>
                );
              })
            )}
          </YStack>
        </SettingsContentScrollView>
      )}
      <ConfirmDialog
        open={Boolean(joinTarget)}
        onOpenChange={(open) => {
          if (!open) setJoinTarget(null);
        }}
        title={`Join ${joinTarget?.label ?? 'group'}?`}
        description="This adds your Tlonbot to the group. After it joins, you can choose which channels it can respond in."
        confirmText="Join"
        onConfirm={() => {
          if (!joinTarget) return;
          const target = joinTarget;
          setJoinTarget(null);
          handleJoinGroup(
            target.groupHost,
            target.groupName,
            target.sampleChannelKey
          );
        }}
      />
    </View>
  );
}
