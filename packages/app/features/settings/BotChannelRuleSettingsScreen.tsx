import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Icon, Pressable, Text, useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback, useMemo, useState } from 'react';
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
import { useBotSettingsDraft } from './bot/useBotSettingsDraft';

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
  const draft = useBotSettingsDraft();
  const allProviderModels = useAllProviderModels(queries.providerConfig);
  const [pendingShip, setPendingShip] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const rule = draft.draft.chat.channelRuleDrafts[channelKey];
  const currentRule: ChannelRuleDraft = useMemo(
    () => rule ?? { mode: 'open', allowedShips: '' },
    [rule]
  );

  // Membership can change while this screen is open (a Join completing on the
  // rules screen, auto-discovery), so derive it live from the moon's channel
  // listing and fall back to the value captured at navigation time.
  const groupJoined = useMemo(() => {
    const parsed = parseChannelRuleKey(channelKey);
    if (!parsed || !queries.channelsQuery.data) {
      return initialGroupJoined;
    }
    const group = resolveGroupForChannel(
      queries.channelsQuery.data,
      parsed.host,
      parsed.channelId
    );
    if (!group) {
      return initialGroupJoined;
    }
    return hasGroupMembership(
      queries.moonChannelsQuery.data ?? {},
      parsed.host,
      group
    );
  }, [
    channelKey,
    initialGroupJoined,
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
      draft.commitDraft((current) => {
        const channelRuleDrafts = { ...current.chat.channelRuleDrafts };
        if (nextRule) {
          // Store empty override fields as absent so "Default model" (the
          // absence of an override) compares equal to a never-set baseline.
          const normalized: ChannelRuleDraft = {
            mode: nextRule.mode,
            allowedShips: nextRule.allowedShips,
          };
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
    [draft, channelKey]
  );

  const patch = useCallback(
    (next: Partial<ChannelRuleDraft>) => {
      // Never create a rule from a subordinate control — only the enable
      // switch may bring a channel's rule into existence.
      if (!rule) return;
      setRule({ ...currentRule, ...next });
    },
    [rule, setRule, currentRule]
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

  const allowedShips = useMemo(
    () => normalizeShipList(currentRule.allowedShips),
    [currentRule.allowedShips]
  );

  const addPendingShip = useCallback(() => {
    const ship = normalizeShip(pendingShip);
    if (!ship) return;
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
      <SettingsContentScrollView
        paddingHorizontal="$l"
        paddingTop="$l"
        safeAreaBottomOffset={24}
      >
        <YStack gap="$2xl" paddingBottom="$2xl">
          <YStack paddingHorizontal="$s" gap="$2xs">
            <Text size="$label/xl" fontWeight="600" numberOfLines={1}>
              {channelLabel}
            </Text>
            <Text size="$label/s" color="$secondaryText" numberOfLines={1}>
              {channelKey}
            </Text>
          </YStack>

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
                setRule(checked ? currentRule : undefined);
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
                        onPress={() =>
                          patch({
                            allowedShips: formatShipList(
                              allowedShips.filter((entry) => entry !== ship)
                            ),
                          })
                        }
                      >
                        <Icon type="Close" size="$m" color="$secondaryText" />
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
              setRule({ mode: 'open', allowedShips: '' });
            }}
          />
          <Button preset="primary" label="Done" centered onPress={handleBack} />
        </YStack>
      </SettingsContentScrollView>
    </View>
  );
}
