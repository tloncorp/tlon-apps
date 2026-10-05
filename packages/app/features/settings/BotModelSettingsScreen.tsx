import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Text } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, YStack } from 'tamagui';

import { RootStackParamList } from '../../navigation/types';
import {
  type SettingsRowModel,
  type SettingsSectionModel,
  SettingsListScreenView,
} from '../../ui/components/SettingsList';
import {
  BASIC_PROVIDER_ID,
  MAX_VISIBLE_MODELS,
  PROVIDER_OPTIONS,
} from './bot/constants';
import { getErrorMessage, getModelDisplayName } from './bot/helpers';
import {
  type ModelPickerProvider,
  blendedPricePerMillion,
  buildDefaultModelSections,
  hiddenModelsNote,
} from './bot/modelPicker';
import {
  useAllProviderModels,
  useBotSettingsQueries,
  useOpenRouterModelMetadata,
} from './bot/useBotSettingsData';
import {
  useBotSettingsDraft,
  useSyncBotSettingsDraft,
} from './bot/useBotSettingsDraft';

type Props = NativeStackScreenProps<RootStackParamList, 'BotModelSettings'>;

const fallbackKey = (selection: { provider: string; model: string }) =>
  `${selection.provider}:${selection.model}`;

export function BotModelSettingsScreen(props: Props) {
  const { mode } = props.route.params;
  const insets = useSafeAreaInsets();
  const queries = useBotSettingsQueries();
  // Sync the draft from the server before editing so reaching this leaf
  // directly (cold launch / deep link) doesn't start from an empty draft and
  // apply empty defaults over the real config. Gate edits on `initialized`.
  useSyncBotSettingsDraft(queries);
  const draft = useBotSettingsDraft();
  // Also require the draft to be scoped to the current ship so a previous
  // account's initialized draft isn't treated as ready after switching.
  const ready = draft.initialized && draft.scopeKey === queries.ship;
  const allProviderModels = useAllProviderModels(
    queries.providerConfig,
    queries.llmAuthStatusQuery.data
  );
  const openRouterMetadata = useOpenRouterModelMetadata(
    allProviderModels.providers.includes('openrouter')
  );
  const [search, setSearch] = useState('');
  const [expandedProviders, setExpandedProviders] = useState<
    ReadonlySet<string>
  >(() => new Set());
  // The list's ZDR filter follows the bot's setting until it is switched here.
  const [zdrOverride, setZdrOverride] = useState<boolean | null>(null);

  const resetPicker = useCallback(() => {
    setSearch('');
    setExpandedProviders(new Set());
    setZdrOverride(null);
  }, []);

  useFocusEffect(resetPicker);

  // The desktop settings drawer keeps this screen mounted across mode
  // switches (default vs fallbacks); clear the picker's state when the mode
  // param changes so it doesn't leak between the two forms.
  useEffect(resetPicker, [mode, resetPicker]);

  const modelValues = draft.draft.model;
  const zdrOnly =
    zdrOverride ?? (modelValues.provider === 'openrouter' && modelValues.zdr);

  const availableProviders = useMemo(
    () =>
      PROVIDER_OPTIONS.filter((option) =>
        allProviderModels.providers.includes(option.id)
      ),
    [allProviderModels.providers]
  );

  const handleBack = useCallback(() => {
    props.navigation.goBack();
  }, [props.navigation]);

  // Picking a model is the whole job here, so it also leaves the screen; the
  // Apply bar on the screen behind is where the change gets confirmed.
  const selectModel = useCallback(
    (provider: string, model: string) => {
      if (!ready) return;
      // Tlon picks the model behind its own option, so a bot already on it
      // has nothing to change; writing our listed id would swap its model.
      if (
        provider === BASIC_PROVIDER_ID &&
        modelValues.provider === BASIC_PROVIDER_ID
      ) {
        props.navigation.goBack();
        return;
      }
      const zdr =
        provider === 'openrouter'
          ? zdrOnly
          : provider === BASIC_PROVIDER_ID &&
            modelValues.provider === BASIC_PROVIDER_ID &&
            modelValues.zdr;
      draft.commitDraft((current) => ({
        ...current,
        model: { ...current.model, provider, model, zdr },
      }));
      props.navigation.goBack();
    },
    [
      draft,
      modelValues.provider,
      modelValues.zdr,
      props.navigation,
      ready,
      zdrOnly,
    ]
  );

  const expandProvider = useCallback((provider: string) => {
    setExpandedProviders((current) => new Set(current).add(provider));
  }, []);

  const toggleFallback = useCallback(
    (selection: { provider: string; model: string }) => {
      if (!ready) return;
      draft.commitDraft((current) => {
        const key = fallbackKey(selection);
        const exists = current.model.fallbacks.some(
          (fallback) => fallbackKey(fallback) === key
        );
        return {
          ...current,
          model: {
            ...current.model,
            fallbacks: exists
              ? current.model.fallbacks.filter(
                  (fallback) => fallbackKey(fallback) !== key
                )
              : [...current.model.fallbacks, selection],
          },
        };
      });
    },
    [draft, ready]
  );

  const removeFallbackAt = useCallback(
    (index: number) => {
      draft.commitDraft((current) => ({
        ...current,
        model: {
          ...current.model,
          fallbacks: current.model.fallbacks.filter((_, i) => i !== index),
        },
      }));
    },
    [draft]
  );

  const recommendedModelRank = useMemo(
    () =>
      new Map(
        openRouterMetadata.recommendedModelIds.map((modelId, index) => [
          modelId,
          index,
        ])
      ),
    [openRouterMetadata.recommendedModelIds]
  );
  const zdrModelIds = useMemo(
    () =>
      new Set(
        openRouterMetadata.zdrEndpoints.map((endpoint) => endpoint.modelId)
      ),
    [openRouterMetadata.zdrEndpoints]
  );
  const zdrPrices = useMemo(() => {
    const prices = new Map<string, number>();
    openRouterMetadata.zdrEndpoints.forEach((endpoint) => {
      const price = blendedPricePerMillion(
        endpoint.promptPrice,
        endpoint.completionPrice
      );
      if (price === null) return;
      const current = prices.get(endpoint.modelId);
      if (current === undefined || price < current) {
        prices.set(endpoint.modelId, price);
      }
    });
    return prices;
  }, [openRouterMetadata.zdrEndpoints]);
  const toggleZdr = useCallback(
    (enabled: boolean) => {
      setZdrOverride(enabled);
      // The bot's own setting follows only while its model stays valid: a
      // model with no ZDR endpoint is left alone until another is picked.
      if (
        modelValues.provider !== 'openrouter' ||
        (enabled && !zdrModelIds.has(modelValues.model))
      ) {
        return;
      }
      draft.commitDraft((current) => ({
        ...current,
        model: { ...current.model, zdr: enabled },
      }));
    },
    [draft, modelValues.model, modelValues.provider, zdrModelIds]
  );

  const normalizedSearch = search.trim().toLowerCase();
  // For fallback mode we search across every provider with a credential.
  const allSelectableModels = useMemo(
    () =>
      availableProviders.flatMap((provider) =>
        (allProviderModels.models[provider.id] || []).map((model) => ({
          key: fallbackKey({ provider: provider.id, model: model.id }),
          providerId: provider.id,
          providerLabel: provider.label,
          modelId: model.id,
          modelLabel: getModelDisplayName(model),
        }))
      ),
    [availableProviders, allProviderModels.models]
  );
  const {
    visible: filteredSelectableModels,
    hidden: hiddenSelectableModelCount,
  } = useMemo(() => {
    const matches = normalizedSearch
      ? allSelectableModels.filter((model) =>
          [model.modelLabel, model.providerLabel, model.modelId].some((value) =>
            value.toLowerCase().includes(normalizedSearch)
          )
        )
      : allSelectableModels;
    return {
      visible: matches.slice(0, MAX_VISIBLE_MODELS),
      hidden: Math.max(0, matches.length - MAX_VISIBLE_MODELS),
    };
  }, [allSelectableModels, normalizedSearch]);
  const selectedFallbackKeys = useMemo(
    () => new Set(modelValues.fallbacks.map(fallbackKey)),
    [modelValues.fallbacks]
  );
  const fallbackLabelByKey = useMemo(
    () =>
      new Map(
        allSelectableModels.map((model) => [
          model.key,
          `${model.providerLabel}: ${model.modelLabel}`,
        ])
      ),
    [allSelectableModels]
  );

  const pickerProviders = useMemo<ModelPickerProvider[]>(
    () =>
      availableProviders.map((provider) => {
        const error = allProviderModels.errors[provider.id];
        return {
          id: provider.id,
          label: provider.label,
          models: allProviderModels.models[provider.id] ?? [],
          loading: Boolean(allProviderModels.loading[provider.id]),
          error: error
            ? (getErrorMessage(error) ?? 'Unable to load models.')
            : null,
        };
      }),
    [allProviderModels, availableProviders]
  );

  const sections = useMemo<SettingsSectionModel[]>(() => {
    const noteRow = (key: string, title: string): SettingsRowModel => ({
      key,
      title,
    });

    if (mode === 'default') {
      return buildDefaultModelSections({
        providers: pickerProviders,
        selection: modelValues,
        search,
        expandedProviders,
        recommendedRank: recommendedModelRank,
        zdr: {
          enabled: zdrOnly,
          loading: openRouterMetadata.loading,
          // A refresh that fails keeps the endpoints it had, which still serve.
          error:
            openRouterMetadata.error && zdrModelIds.size === 0
              ? (getErrorMessage(openRouterMetadata.error) ??
                'Unable to load models.')
              : null,
          modelIds: zdrModelIds,
          prices: zdrPrices,
        },
        onSelect: selectModel,
        onExpand: expandProvider,
        onToggleZdr: toggleZdr,
      });
    }

    return [
      {
        key: 'chain',
        title: 'Fallback chain',
        footer:
          'If the default model fails, Tlonbot tries each of these in order.',
        rows:
          modelValues.fallbacks.length === 0
            ? [noteRow('empty', 'No fallback models set.')]
            : modelValues.fallbacks.map((fallback, index) => ({
                key: `${fallbackKey(fallback)}:${index}`,
                title:
                  fallbackLabelByKey.get(fallbackKey(fallback)) ??
                  `${fallback.provider}: ${fallback.model}`,
                leading: {
                  kind: 'element',
                  render: ({ size }) => (
                    <FallbackPosition position={index + 1} size={size} />
                  ),
                },
                value: 'Remove',
                accessory: 'none',
                onPress: () => removeFallbackAt(index),
              })),
      },
      {
        key: 'available',
        title: 'Available models',
        footer: hiddenModelsNote(hiddenSelectableModelCount),
        rows:
          filteredSelectableModels.length === 0
            ? [
                noteRow(
                  'empty',
                  availableProviders.length === 0
                    ? 'No providers configured.'
                    : 'No models found.'
                ),
              ]
            : filteredSelectableModels.map((model) => ({
                key: model.key,
                title: model.modelLabel,
                subtitle: model.providerLabel,
                selected: selectedFallbackKeys.has(model.key),
                multiple: true,
                onPress: () =>
                  toggleFallback({
                    provider: model.providerId,
                    model: model.modelId,
                  }),
              })),
      },
    ];
  }, [
    availableProviders,
    expandProvider,
    expandedProviders,
    fallbackLabelByKey,
    filteredSelectableModels,
    hiddenSelectableModelCount,
    mode,
    modelValues,
    openRouterMetadata.error,
    openRouterMetadata.loading,
    pickerProviders,
    recommendedModelRank,
    removeFallbackAt,
    search,
    selectModel,
    selectedFallbackKeys,
    toggleFallback,
    toggleZdr,
    zdrModelIds,
    zdrOnly,
    zdrPrices,
  ]);

  return (
    <SettingsListScreenView
      title={mode === 'fallbacks' ? 'Fallback models' : 'Default model'}
      sections={sections}
      onBackPressed={handleBack}
      // Picking a model is the only other way out of the default picker.
      showsBackOnWideWindows={mode === 'default'}
      loading={!ready}
      search={{
        value: search,
        onChangeText: setSearch,
        placeholder: 'Search models',
      }}
      bottomBar={
        ready && mode === 'fallbacks' ? (
          <YStack
            borderTopWidth={1}
            borderColor="$border"
            backgroundColor="$background"
            paddingHorizontal="$l"
            paddingTop="$m"
            paddingBottom={Math.max(insets.bottom, 12)}
          >
            <Button
              preset="primary"
              label="Done"
              onPress={handleBack}
              centered
            />
          </YStack>
        ) : null
      }
    />
  );
}

/** A fallback's place in the chain, in the row's leading slot. */
function FallbackPosition({
  position,
  size,
}: {
  position: number;
  size: number;
}) {
  return (
    <View
      width={size}
      height={size}
      alignItems="center"
      justifyContent="center"
      borderRadius="$m"
      backgroundColor="$secondaryBackground"
    >
      <Text size="$label/m" color="$secondaryText">
        {position}
      </Text>
    </View>
  );
}
