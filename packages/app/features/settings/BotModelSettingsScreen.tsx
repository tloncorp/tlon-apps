import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Button,
  Icon,
  LoadingSpinner,
  Pressable,
  Text,
  useIsWindowNarrow,
} from '@tloncorp/ui';
import { useCallback, useMemo, useState } from 'react';
import { View, XStack, YStack } from 'tamagui';

import { RootStackParamList } from '../../navigation/types';
import { ScreenHeader, SettingsContentScrollView, TextInput } from '../../ui';
import {
  BotSettingsDivider,
  BotSettingsErrorText,
  BotSettingsSection,
  EmptyRowText,
  SelectableRow,
} from './bot/BotSettingsUI';
import {
  BASIC_DEFAULT_MODEL,
  BASIC_PROVIDER_ID,
  MAX_VISIBLE_MODELS,
  PROVIDER_OPTIONS,
} from './bot/constants';
import {
  getErrorMessage,
  getModelDisplayName,
  hasProviderCredential,
} from './bot/helpers';
import {
  useAllProviderModels,
  useBotSettingsQueries,
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
  const isWindowNarrow = useIsWindowNarrow();
  const queries = useBotSettingsQueries();
  // Sync the draft from the server before editing so reaching this leaf
  // directly (cold launch / deep link) doesn't start from an empty draft and
  // apply empty defaults over the real config. Gate edits on `initialized`.
  useSyncBotSettingsDraft(queries);
  const draft = useBotSettingsDraft();
  const ready = draft.initialized;
  const allProviderModels = useAllProviderModels(queries.providerConfig);
  const [search, setSearch] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const modelValues = draft.draft.model;

  const availableProviders = useMemo(
    () =>
      PROVIDER_OPTIONS.filter((option) =>
        hasProviderCredential(queries.providerConfig, option.id)
      ),
    [queries.providerConfig]
  );

  const handleBack = useCallback(() => {
    if (
      mode === 'default' &&
      modelValues.provider !== BASIC_PROVIDER_ID &&
      !modelValues.model
    ) {
      setValidationError('Select a model before continuing.');
      return;
    }
    props.navigation.goBack();
  }, [mode, modelValues, props.navigation]);

  const setModel = useCallback(
    (provider: string, model: string) => {
      if (!ready) return;
      setValidationError(null);
      draft.commitDraft((current) => ({
        ...current,
        model: { ...current.model, provider, model },
      }));
    },
    [draft, ready]
  );

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

  const providerModelsLoading = Boolean(
    allProviderModels.loading[modelValues.provider]
  );
  const providerModelsError = allProviderModels.errors[modelValues.provider];

  const normalizedSearch = search.trim().toLowerCase();
  const { visible: filteredProviderModels, hidden: hiddenProviderModelCount } =
    useMemo(() => {
      const providerModels =
        allProviderModels.models[modelValues.provider] ?? [];
      const matches = normalizedSearch
        ? providerModels.filter((model) =>
            [getModelDisplayName(model), model.id].some((value) =>
              value.toLowerCase().includes(normalizedSearch)
            )
          )
        : providerModels;
      return {
        visible: matches.slice(0, MAX_VISIBLE_MODELS),
        hidden: Math.max(0, matches.length - MAX_VISIBLE_MODELS),
      };
    }, [allProviderModels.models, modelValues.provider, normalizedSearch]);

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

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        borderBottom
        backAction={isWindowNarrow ? handleBack : undefined}
        title={mode === 'default' ? 'Default model' : 'Fallback models'}
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
            {mode === 'default' ? (
              <>
                <BotSettingsSection title="Provider">
                  {availableProviders.map((option, index) => (
                    <YStack key={option.id}>
                      <SelectableRow
                        label={option.label}
                        selected={modelValues.provider === option.id}
                        onPress={() =>
                          setModel(
                            option.id,
                            option.id === BASIC_PROVIDER_ID
                              ? BASIC_DEFAULT_MODEL
                              : ''
                          )
                        }
                      />
                      {index < availableProviders.length - 1 ? (
                        <BotSettingsDivider />
                      ) : null}
                    </YStack>
                  ))}
                </BotSettingsSection>
                {modelValues.provider === BASIC_PROVIDER_ID ? (
                  <Text
                    size="$label/s"
                    color="$secondaryText"
                    paddingHorizontal="$s"
                  >
                    Basic uses MiniMax M3.
                  </Text>
                ) : (
                  <BotSettingsSection title="Model">
                    <View padding="$l">
                      <TextInput
                        value={search}
                        placeholder="Search models"
                        onChangeText={setSearch}
                      />
                    </View>
                    <BotSettingsDivider />
                    {providerModelsLoading ? (
                      <EmptyRowText>Loading models…</EmptyRowText>
                    ) : providerModelsError ? (
                      <EmptyRowText>
                        {getErrorMessage(providerModelsError) ??
                          'Unable to load models.'}
                      </EmptyRowText>
                    ) : filteredProviderModels.length === 0 ? (
                      <EmptyRowText>No models found.</EmptyRowText>
                    ) : (
                      <>
                        {filteredProviderModels.map((model, index) => (
                          <YStack key={model.id}>
                            <SelectableRow
                              label={getModelDisplayName(model)}
                              description={model.id}
                              selected={modelValues.model === model.id}
                              onPress={() =>
                                setModel(modelValues.provider, model.id)
                              }
                            />
                            {index < filteredProviderModels.length - 1 ? (
                              <BotSettingsDivider />
                            ) : null}
                          </YStack>
                        ))}
                        {hiddenProviderModelCount > 0 ? (
                          <EmptyRowText>
                            {hiddenProviderModelCount} more — refine your search
                            to see them.
                          </EmptyRowText>
                        ) : null}
                      </>
                    )}
                  </BotSettingsSection>
                )}
                <BotSettingsErrorText>{validationError}</BotSettingsErrorText>
              </>
            ) : (
              <>
                <Text
                  size="$label/m"
                  color="$secondaryText"
                  paddingHorizontal="$s"
                >
                  If the default model fails, Tlonbot tries each of these in
                  order.
                </Text>
                <BotSettingsSection title="Fallback chain">
                  {modelValues.fallbacks.length === 0 ? (
                    <EmptyRowText>No fallback models set.</EmptyRowText>
                  ) : (
                    modelValues.fallbacks.map((fallback, index) => (
                      <YStack key={`${fallbackKey(fallback)}:${index}`}>
                        <XStack
                          minHeight={56}
                          alignItems="center"
                          gap="$l"
                          paddingHorizontal="$l"
                          paddingVertical="$m"
                        >
                          <View
                            width="$2xl"
                            height="$2xl"
                            alignItems="center"
                            justifyContent="center"
                            borderRadius="$m"
                            backgroundColor="$secondaryBackground"
                          >
                            <Text size="$label/m" color="$secondaryText">
                              {index + 1}
                            </Text>
                          </View>
                          <Text
                            flex={1}
                            size="$label/l"
                            color="$primaryText"
                            numberOfLines={1}
                          >
                            {fallbackLabelByKey.get(fallbackKey(fallback)) ??
                              `${fallback.provider}: ${fallback.model}`}
                          </Text>
                          <Pressable onPress={() => removeFallbackAt(index)}>
                            <Icon
                              type="Close"
                              size="$m"
                              color="$secondaryText"
                            />
                          </Pressable>
                        </XStack>
                        {index < modelValues.fallbacks.length - 1 ? (
                          <BotSettingsDivider />
                        ) : null}
                      </YStack>
                    ))
                  )}
                </BotSettingsSection>
                <BotSettingsSection title="Available models">
                  <View padding="$l">
                    <TextInput
                      value={search}
                      placeholder="Search models"
                      onChangeText={setSearch}
                    />
                  </View>
                  <BotSettingsDivider />
                  {filteredSelectableModels.length === 0 ? (
                    <EmptyRowText>
                      {availableProviders.length === 0
                        ? 'No providers configured.'
                        : 'No models found.'}
                    </EmptyRowText>
                  ) : (
                    <>
                      {filteredSelectableModels.map((model, index) => (
                        <YStack key={model.key}>
                          <SelectableRow
                            label={model.modelLabel}
                            description={model.providerLabel}
                            selected={selectedFallbackKeys.has(model.key)}
                            onPress={() =>
                              toggleFallback({
                                provider: model.providerId,
                                model: model.modelId,
                              })
                            }
                          />
                          {index < filteredSelectableModels.length - 1 ? (
                            <BotSettingsDivider />
                          ) : null}
                        </YStack>
                      ))}
                      {hiddenSelectableModelCount > 0 ? (
                        <EmptyRowText>
                          {hiddenSelectableModelCount} more — refine your search
                          to see them.
                        </EmptyRowText>
                      ) : null}
                    </>
                  )}
                </BotSettingsSection>
              </>
            )}
            <Button
              preset="primary"
              label="Done"
              onPress={handleBack}
              centered
            />
          </YStack>
        </SettingsContentScrollView>
      )}
    </View>
  );
}
