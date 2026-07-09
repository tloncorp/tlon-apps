import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Button,
  Icon,
  LoadingSpinner,
  Pressable,
  Text,
  useIsWindowNarrow,
} from '@tloncorp/ui';
import { valid } from '@urbit/aura';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, XStack, YStack } from 'tamagui';

import { RootStackParamList } from '../../navigation/types';
import { ScreenHeader, SettingsContentScrollView, TextInput } from '../../ui';
import {
  BotSettingsDivider,
  BotSettingsErrorText,
  BotSettingsSection,
  BotSwitchRow,
  EmptyRowText,
  SelectableRow,
} from './bot/BotSettingsUI';
import {
  BASIC_DEFAULT_MODEL,
  BASIC_PROVIDER_ID,
  BASIC_PROVIDER_LABEL,
  MAX_VISIBLE_MODELS,
  PROVIDER_OPTIONS,
} from './bot/constants';
import {
  ChannelRuleDraft,
  formatShipList,
  getErrorMessage,
  getModelDisplayName,
  hasGroupMembership,
  normalizeShip,
  normalizeShipList,
  parseChannelRuleKey,
  resolveGroupForChannel,
} from './bot/helpers';
import {
  useAllProviderModels,
  useBotSettingsQueries,
} from './bot/useBotSettingsData';
import {
  useBotSettingsDraft,
  useSyncBotSettingsDraft,
} from './bot/useBotSettingsDraft';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'BotChannelRuleSettings'
>;

const ACCESS_MODES: {
  id: 'open' | 'allowlist';
  label: string;
  description: string;
}[] = [
  { id: 'open', label: 'Open', description: 'Anyone in the channel can chat' },
  {
    id: 'allowlist',
    label: 'Allowlist only',
    description: 'Authorized users only',
  },
];

export function BotChannelRuleSettingsScreen(props: Props) {
  const {
    channelKey,
    channelLabel,
    groupJoined: initialGroupJoined,
  } = props.route.params;
  const isWindowNarrow = useIsWindowNarrow();
  const queries = useBotSettingsQueries();
  // Sync the draft from the server before editing: a restored stack / deep link
  // can mount this per-channel screen without the list having initialized the
  // store, and enabling this channel from an empty draft would drop the rest of
  // the chat settings on save. Gate edits until the draft is scoped and ready.
  useSyncBotSettingsDraft(queries);
  const draft = useBotSettingsDraft();
  const ready = draft.initialized && draft.scopeKey === queries.ship;
  const allProviderModels = useAllProviderModels(queries.providerConfig);
  const [pendingShip, setPendingShip] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // The route's groupJoined was computed for the ship active at navigation. If
  // the desktop drawer keeps this screen mounted across a ship switch, that
  // value is stale for the new ship, so stop trusting it and let membership be
  // re-derived from the new ship's moon listing. (Only drop it on a genuine
  // ship→ship transition, not the initial resolve.)
  // Remember the rule as it was when the channel was last disabled, so a
  // canceling off→on toggle restores the exact settings (allowlist, mode, model
  // override) the user had — including unsaved edits — instead of resetting to
  // the inherited default. Reset when the channel param or ship changes (below).
  const disabledRuleRef = useRef<ChannelRuleDraft | undefined>(undefined);

  const [routeGroupJoined, setRouteGroupJoined] = useState(initialGroupJoined);
  const shipRef = useRef(queries.ship);
  useEffect(() => {
    if (shipRef.current && queries.ship && shipRef.current !== queries.ship) {
      setRouteGroupJoined(false);
      // The pre-disable snapshot belongs to the previous ship; drop it so
      // re-enabling on the new ship doesn't copy the old ship's rule.
      disabledRuleRef.current = undefined;
    }
    shipRef.current = queries.ship;
  }, [queries.ship]);

  // The desktop settings drawer keeps this screen mounted across channel
  // switches; clear per-channel input state when the channel param changes so
  // a half-typed ship or search doesn't leak into another channel's editor.
  // Also re-seed routeGroupJoined from the new channel's route param, or the
  // previous channel's membership value would bypass the read-only guard for a
  // group the bot may not have joined.
  useEffect(() => {
    setPendingShip('');
    setModelSearch('');
    setValidationError(null);
    disabledRuleRef.current = undefined;
    setRouteGroupJoined(initialGroupJoined);
  }, [channelKey, initialGroupJoined]);

  const rule = draft.draft.chat.channelRuleDrafts[channelKey];
  const baselineRule = draft.baseline.chat.channelRuleDrafts[channelKey];
  // Once a disable is applied (the channel leaves the saved baseline), forget
  // the pre-disable snapshot — otherwise re-enabling later (screen still mounted
  // in the drawer) would restore the stale rule instead of the current default.
  useEffect(() => {
    if (!baselineRule) disabledRuleRef.current = undefined;
  }, [baselineRule]);

  const currentRule: ChannelRuleDraft = useMemo(
    () => rule ?? { mode: 'open', allowedShips: '' },
    [rule]
  );

  // Membership can change while this screen is open (a Join completing on the
  // rules screen, auto-discovery), so derive it live from the moon's channel
  // listing and fall back to the value captured at navigation time.
  const groupJoined = useMemo(() => {
    // The bot can't have a saved rule for a channel in a group it isn't in, so
    // an existing baseline rule means it's a member (the moon's live listing
    // lags/omits joined groups). Also trust the navigation-time value, which
    // already factors this in for the whole group.
    if (draft.baseline.chat.channelRuleDrafts[channelKey] || routeGroupJoined) {
      return true;
    }
    const parsed = parseChannelRuleKey(channelKey);
    if (!parsed || !queries.channelsQuery.data) {
      return routeGroupJoined;
    }
    const group = resolveGroupForChannel(
      queries.channelsQuery.data,
      parsed.host,
      parsed.channelId
    );
    if (!group) {
      return routeGroupJoined;
    }
    // Until the moon's channel listing has loaded, membership is unknown —
    // keep the value captured at navigation time rather than reading the empty
    // fallback as "not joined" and flipping a joined channel to read-only.
    if (queries.moonChannelsQuery.data === undefined) {
      return routeGroupJoined;
    }
    return hasGroupMembership(
      queries.moonChannelsQuery.data,
      parsed.host,
      group
    );
  }, [
    channelKey,
    routeGroupJoined,
    draft.baseline.chat.channelRuleDrafts,
    queries.channelsQuery.data,
    queries.moonChannelsQuery.data,
  ]);
  const readOnly = !groupJoined;
  // The access-mode, allowlist, and model controls only make sense once the
  // channel has a rule. Disable them (and no-op patch) while it's off so
  // merely inspecting a disabled channel can't create a rule and silently
  // enable Tlonbot in it.
  const controlsDisabled = readOnly || !rule;

  const availableProviders = useMemo(
    () =>
      PROVIDER_OPTIONS.filter(
        (provider) =>
          queries.providerConfig.keys?.[provider.id] ||
          (provider.id === BASIC_PROVIDER_ID &&
            queries.providerConfig.defaultKeys?.[BASIC_PROVIDER_ID])
      ),
    [queries.providerConfig]
  );
  const hasCustomProviderKey = availableProviders.some(
    (provider) => provider.id !== BASIC_PROVIDER_ID
  );
  const isCustomModel = Boolean(currentRule.modelOverrideProvider);

  const setRule = useCallback(
    (nextRule: ChannelRuleDraft | undefined) => {
      if (!ready) return;
      draft.commitDraft((current) => {
        const channelRuleDrafts = { ...current.chat.channelRuleDrafts };
        if (nextRule) {
          // Store empty override fields as absent so "Default model" (the
          // absence of an override) compares equal to a never-set baseline.
          const normalized: ChannelRuleDraft = {
            mode: nextRule.mode,
            allowedShips: nextRule.allowedShips,
          };
          // Preserve the inherited-defaults flag; `patch` clears it when the
          // access mode or allowlist is actually edited, so a model-only change
          // keeps the channel following defaultAuthorizedShips.
          if (nextRule.inheritsDefaultShips) {
            normalized.inheritsDefaultShips = true;
          }
          if (nextRule.modelOverrideProvider) {
            normalized.modelOverrideProvider = nextRule.modelOverrideProvider;
          }
          if (nextRule.modelOverride) {
            normalized.modelOverride = nextRule.modelOverride;
          }
          channelRuleDrafts[channelKey] = normalized;
        } else {
          delete channelRuleDrafts[channelKey];
        }
        return {
          ...current,
          chat: { ...current.chat, channelRuleDrafts },
        };
      });
    },
    [draft, channelKey, ready]
  );

  const patch = useCallback(
    (next: Partial<ChannelRuleDraft>) => {
      // Never create a rule from a subordinate control — only the enable
      // switch may bring a channel's rule into existence.
      if (!rule) return;
      // Tapping the already-selected access mode changes nothing — don't let
      // it convert an inherited rule into an explicit one.
      if (
        next.mode !== undefined &&
        next.mode === currentRule.mode &&
        next.allowedShips === undefined
      ) {
        return;
      }
      // Editing the access mode or allowlist makes the allowlist explicit, so
      // drop the inherited flag; a model-only edit leaves it intact so the
      // channel keeps following defaultAuthorizedShips. When an inherited rule
      // becomes explicit, materialize the allowlist from the live defaults —
      // the snapshot stored on the rule can predate an edit to
      // defaultAuthorizedShips made in this same form.
      const editsAccess =
        next.mode !== undefined || next.allowedShips !== undefined;
      const base =
        editsAccess && currentRule.inheritsDefaultShips
          ? {
              ...currentRule,
              allowedShips: draft.draft.chat.defaultAuthorizedShips,
            }
          : currentRule;
      setRule({
        ...base,
        ...(editsAccess ? { inheritsDefaultShips: false } : {}),
        ...next,
      });
    },
    [rule, setRule, currentRule, draft.draft.chat.defaultAuthorizedShips]
  );

  const handleBack = useCallback(() => {
    if (
      rule?.modelOverrideProvider &&
      rule.modelOverrideProvider !== BASIC_PROVIDER_ID &&
      !rule.modelOverride
    ) {
      setValidationError('Select a model for this channel before leaving.');
      return;
    }
    props.navigation.goBack();
  }, [rule, props.navigation]);

  // While the rule inherits defaults, show (and edit from) the live
  // defaultAuthorizedShips rather than the snapshot stored on the rule — an
  // add/remove makes the list explicit via patch, and it must start from the
  // current defaults, not a stale copy captured when the draft was built.
  const allowedShips = useMemo(
    () =>
      normalizeShipList(
        currentRule.inheritsDefaultShips
          ? draft.draft.chat.defaultAuthorizedShips
          : currentRule.allowedShips
      ),
    [
      currentRule.inheritsDefaultShips,
      currentRule.allowedShips,
      draft.draft.chat.defaultAuthorizedShips,
    ]
  );

  const addPendingShip = useCallback(() => {
    const ship = normalizeShip(pendingShip);
    if (!ship) return;
    // normalizeShip only adds a leading ~; reject anything that isn't a real
    // @p so Apply can't send a malformed allowedShips entry (e.g. "foo!").
    if (!valid('p', ship)) {
      setValidationError(`"${pendingShip.trim()}" is not a valid ship name.`);
      return;
    }
    setValidationError(null);
    if (!allowedShips.includes(ship)) {
      patch({ allowedShips: formatShipList([...allowedShips, ship]) });
    }
    setPendingShip('');
  }, [pendingShip, allowedShips, patch]);

  const overrideProvider = currentRule.modelOverrideProvider || '';
  const overrideModelsLoading = Boolean(
    allProviderModels.loading[overrideProvider]
  );
  const overrideModelsError = allProviderModels.errors[overrideProvider];
  const normalizedModelSearch = modelSearch.trim().toLowerCase();
  const { visible: filteredOverrideModels, hidden: hiddenOverrideModelCount } =
    useMemo(() => {
      const overrideModels = allProviderModels.models[overrideProvider] ?? [];
      const matches = normalizedModelSearch
        ? overrideModels.filter((model) =>
            [getModelDisplayName(model), model.id].some((value) =>
              value.toLowerCase().includes(normalizedModelSearch)
            )
          )
        : overrideModels;
      return {
        visible: matches.slice(0, MAX_VISIBLE_MODELS),
        hidden: Math.max(0, matches.length - MAX_VISIBLE_MODELS),
      };
    }, [allProviderModels.models, overrideProvider, normalizedModelSearch]);

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        borderBottom
        backAction={isWindowNarrow ? handleBack : undefined}
        title={channelLabel || 'Channel'}
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
          <YStack gap="$2xl" paddingBottom="$2xl">
            <BotSettingsSection
              description={
                !groupJoined
                  ? 'Join this group to enable Tlonbot in this channel.'
                  : undefined
              }
            >
              <BotSwitchRow
                label="Enable Tlonbot here"
                description={
                  rule
                    ? 'Listening for prompts'
                    : 'Tlonbot will ignore this channel'
                }
                checked={Boolean(rule)}
                disabled={readOnly}
                onCheckedChange={(checked) => {
                  setValidationError(null);
                  if (!checked) {
                    // Stash the current settings so re-enabling can restore them
                    // rather than discarding an allowlist/override on a cancel.
                    disabledRuleRef.current = rule;
                    setRule(undefined);
                    return;
                  }
                  // Restore the just-disabled rule (unsaved edits included), then
                  // the saved rule for an already-configured channel; only a
                  // genuinely new channel falls back to the default allowlist
                  // that inherits defaultAuthorizedShips.
                  setRule(
                    rule ??
                      disabledRuleRef.current ??
                      baselineRule ?? {
                        mode: 'allowlist',
                        allowedShips: draft.draft.chat.defaultAuthorizedShips,
                        inheritsDefaultShips: true,
                      }
                  );
                }}
              />
            </BotSettingsSection>

            <BotSettingsSection title="Access mode">
              {ACCESS_MODES.map((mode, index) => (
                <YStack key={mode.id}>
                  <SelectableRow
                    label={mode.label}
                    description={mode.description}
                    selected={currentRule.mode === mode.id}
                    disabled={controlsDisabled}
                    onPress={() => patch({ mode: mode.id })}
                  />
                  {index < ACCESS_MODES.length - 1 ? (
                    <BotSettingsDivider />
                  ) : null}
                </YStack>
              ))}
              {currentRule.mode === 'allowlist' ? (
                <>
                  <BotSettingsDivider />
                  <YStack padding="$l" gap="$m">
                    <Text size="$label/m" color="$tertiaryText">
                      Allowed users
                    </Text>
                    <XStack gap="$m" alignItems="center">
                      <View flex={1}>
                        <TextInput
                          value={pendingShip}
                          placeholder="~zod, ~nec"
                          autoCapitalize="none"
                          autoCorrect={false}
                          editable={!controlsDisabled}
                          onChangeText={setPendingShip}
                          onSubmitEditing={addPendingShip}
                          returnKeyType="done"
                        />
                      </View>
                      <Button
                        preset="secondary"
                        label="Add"
                        disabled={controlsDisabled || !pendingShip.trim()}
                        onPress={addPendingShip}
                      />
                    </XStack>
                    {allowedShips.map((ship) => (
                      <XStack
                        key={ship}
                        alignItems="center"
                        justifyContent="space-between"
                        gap="$m"
                      >
                        <Text size="$label/l" color="$primaryText">
                          {ship}
                        </Text>
                        <Pressable
                          disabled={controlsDisabled}
                          onPress={() =>
                            patch({
                              allowedShips: formatShipList(
                                allowedShips.filter((entry) => entry !== ship)
                              ),
                            })
                          }
                        >
                          <Icon
                            type="Close"
                            size="$m"
                            color="$secondaryText"
                            opacity={controlsDisabled ? 0.4 : 1}
                          />
                        </Pressable>
                      </XStack>
                    ))}
                    <Text size="$label/s" color="$secondaryText">
                      Only these users can invoke Tlonbot in this channel.
                    </Text>
                  </YStack>
                </>
              ) : null}
            </BotSettingsSection>

            <BotSettingsSection
              title="Model"
              description={
                !hasCustomProviderKey
                  ? 'Add an API key in Bot settings to use a custom model here.'
                  : undefined
              }
            >
              <SelectableRow
                label="Default model"
                description="Inherit from setup"
                selected={!isCustomModel}
                disabled={controlsDisabled}
                onPress={() => {
                  setValidationError(null);
                  patch({ modelOverrideProvider: '', modelOverride: '' });
                }}
              />
              <BotSettingsDivider />
              <SelectableRow
                label="Custom model"
                description="Override for this channel"
                selected={isCustomModel}
                disabled={controlsDisabled || !hasCustomProviderKey}
                onPress={() => {
                  // Already on a custom override — re-tapping shouldn't reset it
                  // to the first provider and clear the chosen model.
                  if (isCustomModel) return;
                  const provider =
                    availableProviders.find(
                      (option) => option.id !== BASIC_PROVIDER_ID
                    )?.id ||
                    availableProviders[0]?.id ||
                    BASIC_PROVIDER_ID;
                  patch({
                    modelOverrideProvider: provider,
                    modelOverride:
                      provider === BASIC_PROVIDER_ID ? BASIC_DEFAULT_MODEL : '',
                  });
                }}
              />
              {isCustomModel ? (
                <>
                  <BotSettingsDivider />
                  <YStack padding="$l" gap="$m">
                    <Text size="$label/m" color="$tertiaryText">
                      Provider
                    </Text>
                    <XStack gap="$m" flexWrap="wrap">
                      {availableProviders.map((provider) => (
                        <Button
                          key={provider.id}
                          preset={
                            overrideProvider === provider.id
                              ? 'secondary'
                              : 'secondaryOutline'
                          }
                          label={provider.label}
                          disabled={controlsDisabled}
                          onPress={() => {
                            // Re-tapping the current provider must not clear the
                            // already-selected override model.
                            if (provider.id === overrideProvider) return;
                            setValidationError(null);
                            patch({
                              modelOverrideProvider: provider.id,
                              modelOverride:
                                provider.id === BASIC_PROVIDER_ID
                                  ? BASIC_DEFAULT_MODEL
                                  : '',
                            });
                          }}
                        />
                      ))}
                    </XStack>
                    {overrideProvider === BASIC_PROVIDER_ID ? (
                      <Text size="$label/s" color="$secondaryText">
                        {BASIC_PROVIDER_LABEL}
                      </Text>
                    ) : (
                      <YStack gap="$m">
                        <TextInput
                          value={modelSearch}
                          placeholder="Search models"
                          editable={!controlsDisabled}
                          onChangeText={setModelSearch}
                        />
                        {overrideModelsLoading ? (
                          <EmptyRowText>Loading models…</EmptyRowText>
                        ) : overrideModelsError ? (
                          <EmptyRowText>
                            {getErrorMessage(overrideModelsError) ??
                              'Unable to load models.'}
                          </EmptyRowText>
                        ) : filteredOverrideModels.length === 0 ? (
                          <EmptyRowText>No models found.</EmptyRowText>
                        ) : (
                          <>
                            {filteredOverrideModels.map((model, index) => (
                              <YStack key={model.id}>
                                <SelectableRow
                                  label={getModelDisplayName(model)}
                                  description={model.id}
                                  selected={
                                    currentRule.modelOverride === model.id
                                  }
                                  disabled={controlsDisabled}
                                  onPress={() => {
                                    setValidationError(null);
                                    patch({ modelOverride: model.id });
                                  }}
                                />
                                {index < filteredOverrideModels.length - 1 ? (
                                  <BotSettingsDivider />
                                ) : null}
                              </YStack>
                            ))}
                            {hiddenOverrideModelCount > 0 ? (
                              <EmptyRowText>
                                {hiddenOverrideModelCount} more — refine your
                                search to see them.
                              </EmptyRowText>
                            ) : null}
                          </>
                        )}
                      </YStack>
                    )}
                  </YStack>
                </>
              ) : null}
            </BotSettingsSection>

            <BotSettingsErrorText>{validationError}</BotSettingsErrorText>

            <Button
              preset="destructive"
              label="Reset to defaults"
              centered
              disabled={controlsDisabled}
              onPress={() => {
                setValidationError(null);
                // The default is an allowlist inheriting defaultAuthorizedShips
                // — not open. Restore that (and drop any model override) rather
                // than widening the channel to every member.
                setRule({
                  mode: 'allowlist',
                  allowedShips: draft.draft.chat.defaultAuthorizedShips,
                  inheritsDefaultShips: true,
                });
              }}
            />
            <Button
              preset="primary"
              label="Done"
              centered
              onPress={handleBack}
            />
          </YStack>
        </SettingsContentScrollView>
      )}
    </View>
  );
}
