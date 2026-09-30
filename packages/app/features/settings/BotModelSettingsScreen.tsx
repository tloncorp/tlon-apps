import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TlawnProviderModel } from '@tloncorp/api';
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
  BASIC_DEFAULT_MODEL,
  BASIC_PROVIDER_ID,
  MAX_VISIBLE_MODELS,
  PROVIDER_OPTIONS,
  providerLabel,
} from './bot/constants';
import { getErrorMessage, getModelDisplayName } from './bot/helpers';
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

const parseTokenPrice = (value?: string) => {
  if (!value?.trim()) return null;
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price : null;
};

const blendedPricePerMillion = (
  promptPrice?: string,
  completionPrice?: string
) => {
  const input = parseTokenPrice(promptPrice);
  const output = parseTokenPrice(completionPrice);
  if (input === null || output === null) return null;
  return 1_000_000 * (0.8 * input + 0.2 * output);
};

const formatBlendedPrice = (price: number | null, zdr: boolean) => {
  if (price === null) return null;
  if (price === 0) return 'free';
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: price < 1 ? 2 : 0,
    maximumFractionDigits: price < 0.01 ? 4 : 2,
  }).format(price);
  return `${zdr ? 'from ' : '~'}$${formatted} / 1m`;
};

const prioritizeModels = (
  models: TlawnProviderModel[],
  recommendedRank: Map<string, number>
) =>
  [...models].sort((left, right) => {
    const leftRank = recommendedRank.get(left.id);
    const rightRank = recommendedRank.get(right.id);
    if (leftRank === undefined && rightRank === undefined) return 0;
    if (leftRank === undefined) return 1;
    if (rightRank === undefined) return -1;
    return leftRank - rightRank;
  });

const hiddenModelsNote = (count: number) =>
  count > 0 ? `${count} more — refine your search to see them.` : undefined;

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
  const [validationError, setValidationError] = useState<string | null>(null);
  const [defaultStep, setDefaultStep] = useState<'provider' | 'model'>(
    'provider'
  );
  const [selectedProvider, setSelectedProvider] = useState('');
  const [zdrOnly, setZdrOnly] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setSearch('');
      setValidationError(null);
      setDefaultStep('provider');
      setSelectedProvider('');
      setZdrOnly(false);
    }, [])
  );

  // The desktop settings drawer keeps this screen mounted across mode
  // switches (default vs fallbacks); clear the search and validation state
  // when the mode param changes so they don't leak between the two forms.
  useEffect(() => {
    setSearch('');
    setValidationError(null);
    setDefaultStep('provider');
    setSelectedProvider('');
    setZdrOnly(false);
  }, [mode]);

  const modelValues = draft.draft.model;

  useEffect(() => {
    if (
      mode === 'default' &&
      ready &&
      defaultStep === 'provider' &&
      !selectedProvider
    ) {
      setSelectedProvider(modelValues.provider);
    }
  }, [defaultStep, mode, modelValues.provider, ready, selectedProvider]);

  const availableProviders = useMemo(
    () =>
      PROVIDER_OPTIONS.filter((option) =>
        allProviderModels.providers.includes(option.id)
      ),
    [allProviderModels.providers]
  );

  const handleBack = useCallback(() => {
    if (mode === 'default' && defaultStep === 'model') {
      setSearch('');
      setValidationError(null);
      setDefaultStep('provider');
      return;
    }
    setSelectedProvider('');
    props.navigation.goBack();
  }, [defaultStep, mode, props.navigation]);

  const handleDone = useCallback(() => {
    if (mode === 'default' && (!modelValues.provider || !modelValues.model)) {
      setValidationError('Select a model before continuing.');
      return;
    }
    setSelectedProvider('');
    setDefaultStep('provider');
    props.navigation.goBack();
  }, [mode, modelValues.model, modelValues.provider, props.navigation]);

  const setModel = useCallback(
    (provider: string, model: string, zdr = false) => {
      if (!ready) return;
      setValidationError(null);
      draft.commitDraft((current) => ({
        ...current,
        model: {
          ...current.model,
          provider,
          model,
          zdr:
            (provider === 'openrouter' || provider === BASIC_PROVIDER_ID) &&
            zdr,
        },
      }));
    },
    [draft, ready]
  );

  const selectProvider = useCallback(
    (provider: string) => {
      if (provider === BASIC_PROVIDER_ID) {
        setModel(
          BASIC_PROVIDER_ID,
          BASIC_DEFAULT_MODEL,
          modelValues.provider === BASIC_PROVIDER_ID && modelValues.zdr
        );
        setSelectedProvider('');
        props.navigation.goBack();
        return;
      }
      setSelectedProvider(provider);
      setZdrOnly(
        provider === 'openrouter' &&
          modelValues.provider === 'openrouter' &&
          modelValues.zdr
      );
      setSearch('');
      setValidationError(null);
    },
    [modelValues.provider, modelValues.zdr, props.navigation, setModel]
  );

  const chooseModel = useCallback(() => {
    if (!selectedProvider || selectedProvider === BASIC_PROVIDER_ID) return;
    setZdrOnly(
      selectedProvider === 'openrouter' &&
        modelValues.provider === 'openrouter' &&
        modelValues.zdr
    );
    setSearch('');
    setValidationError(null);
    setDefaultStep('model');
  }, [modelValues.provider, modelValues.zdr, selectedProvider]);

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

  const modelListProvider =
    mode === 'default' ? selectedProvider : modelValues.provider;
  const isOpenRouterModelList = modelListProvider === 'openrouter';
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
  const providerModelsLoading = Boolean(
    allProviderModels.loading[modelListProvider] ||
    (isOpenRouterModelList && zdrOnly && openRouterMetadata.loading)
  );
  const providerModelsError =
    allProviderModels.errors[modelListProvider] ||
    (isOpenRouterModelList && zdrOnly ? openRouterMetadata.error : null);

  const toggleZdr = useCallback(
    (enabled: boolean) => {
      setZdrOnly(enabled);
      if (modelValues.provider !== 'openrouter') return;
      draft.commitDraft((current) => ({
        ...current,
        model: {
          ...current.model,
          zdr: enabled,
          model:
            enabled &&
            current.model.model &&
            !zdrModelIds.has(current.model.model)
              ? ''
              : current.model.model,
        },
      }));
    },
    [draft, modelValues.provider, zdrModelIds]
  );

  const normalizedSearch = search.trim().toLowerCase();
  const { visible: filteredProviderModels, hidden: hiddenProviderModelCount } =
    useMemo(() => {
      const providerModels = allProviderModels.models[modelListProvider] ?? [];
      const eligibleModels =
        isOpenRouterModelList && zdrOnly
          ? providerModels.filter((model) => zdrModelIds.has(model.id))
          : providerModels;
      const prioritizedModels = isOpenRouterModelList
        ? prioritizeModels(eligibleModels, recommendedModelRank)
        : eligibleModels;
      const matches = normalizedSearch
        ? prioritizedModels.filter((model) =>
            [getModelDisplayName(model), model.id].some((value) =>
              value.toLowerCase().includes(normalizedSearch)
            )
          )
        : prioritizedModels;
      return {
        visible: matches.slice(0, MAX_VISIBLE_MODELS),
        hidden: Math.max(0, matches.length - MAX_VISIBLE_MODELS),
      };
    }, [
      allProviderModels.models,
      isOpenRouterModelList,
      modelListProvider,
      normalizedSearch,
      recommendedModelRank,
      zdrModelIds,
      zdrOnly,
    ]);

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

  const sections = useMemo<SettingsSectionModel[]>(() => {
    const noteRow = (key: string, title: string): SettingsRowModel => ({
      key,
      title,
    });

    if (mode === 'default' && defaultStep === 'provider') {
      return [
        {
          key: 'provider',
          title: 'Provider',
          footer: validationError ?? undefined,
          rows: availableProviders.map((option) => ({
            key: option.id,
            title: option.label,
            selected: selectedProvider === option.id,
            onPress: () => selectProvider(option.id),
          })),
        },
      ];
    }

    if (mode === 'default') {
      const modelRows: SettingsRowModel[] = providerModelsLoading
        ? [noteRow('loading', 'Loading models…')]
        : providerModelsError
          ? [
              noteRow(
                'error',
                getErrorMessage(providerModelsError) ?? 'Unable to load models.'
              ),
            ]
          : filteredProviderModels.length === 0
            ? [noteRow('empty', 'No models found.')]
            : filteredProviderModels.map((model) => {
                const price = formatBlendedPrice(
                  zdrOnly
                    ? (zdrPrices.get(model.id) ?? null)
                    : blendedPricePerMillion(
                        model.pricing?.prompt,
                        model.pricing?.completion
                      ),
                  zdrOnly
                );
                const tags = [
                  recommendedModelRank.has(model.id) ? 'Recommended' : null,
                  zdrOnly && zdrModelIds.has(model.id) ? 'ZDR' : null,
                ].filter(Boolean);
                return {
                  key: model.id,
                  title: getModelDisplayName(model),
                  subtitle: [model.id, price].filter(Boolean).join(' · '),
                  value: tags.length > 0 ? tags.join(' · ') : undefined,
                  selected:
                    modelValues.provider === selectedProvider &&
                    modelValues.model === model.id,
                  onPress: () => setModel(selectedProvider, model.id, zdrOnly),
                };
              });

      return [
        ...(selectedProvider === 'openrouter'
          ? [
              {
                key: 'zdr',
                rows: [
                  {
                    key: 'zdr',
                    title: 'Zero data retention',
                    subtitle: zdrOnly
                      ? 'Showing only models with eligible ZDR endpoints.'
                      : 'Only use endpoints that retain no data.',
                    disabled:
                      openRouterMetadata.loading ||
                      (!zdrOnly && zdrModelIds.size === 0),
                    toggle: { value: zdrOnly, onValueChange: toggleZdr },
                  },
                ],
              },
            ]
          : []),
        {
          key: 'models',
          title: `${providerLabel(selectedProvider)} models`,
          footer:
            [hiddenModelsNote(hiddenProviderModelCount), validationError]
              .filter(Boolean)
              .join('\n\n') || undefined,
          rows: modelRows,
        },
      ];
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
    defaultStep,
    fallbackLabelByKey,
    filteredProviderModels,
    filteredSelectableModels,
    hiddenProviderModelCount,
    hiddenSelectableModelCount,
    mode,
    modelValues,
    openRouterMetadata.loading,
    providerModelsError,
    providerModelsLoading,
    recommendedModelRank,
    removeFallbackAt,
    selectProvider,
    selectedFallbackKeys,
    selectedProvider,
    setModel,
    toggleFallback,
    toggleZdr,
    validationError,
    zdrModelIds,
    zdrOnly,
    zdrPrices,
  ]);

  const onProviderStep = mode === 'default' && defaultStep === 'provider';
  const primaryAction = onProviderStep
    ? {
        label: 'Choose Model',
        disabled: !selectedProvider || selectedProvider === BASIC_PROVIDER_ID,
        onPress: chooseModel,
      }
    : {
        label: 'Done',
        disabled:
          mode === 'default' &&
          (modelValues.provider !== selectedProvider || !modelValues.model),
        onPress: handleDone,
      };

  return (
    <SettingsListScreenView
      title={
        mode === 'fallbacks'
          ? 'Fallback models'
          : onProviderStep
            ? 'Choose provider'
            : 'Choose model'
      }
      sections={sections}
      onBackPressed={handleBack}
      showsBackOnWideWindows={mode === 'default' && defaultStep === 'model'}
      loading={!ready}
      search={
        onProviderStep
          ? undefined
          : {
              value: search,
              onChangeText: setSearch,
              placeholder: 'Search models',
            }
      }
      bottomBar={
        ready ? (
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
              label={primaryAction.label}
              disabled={primaryAction.disabled}
              onPress={primaryAction.onPress}
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
