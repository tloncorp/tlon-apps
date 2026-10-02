import type { TlawnProviderModel } from '@tloncorp/api';

import type {
  SettingsRowModel,
  SettingsSectionModel,
} from '../../../ui/components/SettingsList';
import { BASIC_PROVIDER_ID, MAX_VISIBLE_MODELS } from './constants';
import { getModelDisplayName } from './helpers';

/** How many of a provider's models show before "See all". */
export const COLLAPSED_MODEL_COUNT = 5;

const ZDR_PROVIDER_ID = 'openrouter';

export type ModelPickerProvider = {
  id: string;
  label: string;
  models: TlawnProviderModel[];
  loading: boolean;
  error: string | null;
};

const parseTokenPrice = (value?: string) => {
  if (!value?.trim()) return null;
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price : null;
};

export const blendedPricePerMillion = (
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

export const hiddenModelsNote = (count: number) =>
  count > 0 ? `${count} more — refine your search to see them.` : undefined;

const noteRow = (key: string, title: string): SettingsRowModel => ({
  key,
  title,
});

/**
 * The default-model picker as one list: a section per provider, each model a
 * choice. A long catalog shows its first few models until it is opened up or
 * searched, with the current model and any recommended ones first.
 */
export function buildDefaultModelSections({
  providers,
  selection,
  search,
  expandedProviders,
  recommendedRank,
  zdr,
  onSelect,
  onExpand,
  onToggleZdr,
}: {
  providers: ModelPickerProvider[];
  selection: { provider: string; model: string };
  search: string;
  expandedProviders: ReadonlySet<string>;
  recommendedRank: ReadonlyMap<string, number>;
  zdr: {
    enabled: boolean;
    loading: boolean;
    modelIds: ReadonlySet<string>;
    prices: ReadonlyMap<string, number>;
  };
  onSelect: (provider: string, model: string) => void;
  onExpand: (provider: string) => void;
  onToggleZdr: (enabled: boolean) => void;
}): SettingsSectionModel[] {
  const query = search.trim().toLowerCase();

  const sections = providers.flatMap<SettingsSectionModel>((provider) => {
    const isSelected = (model: TlawnProviderModel) =>
      selection.provider === provider.id && selection.model === model.id;
    const key = `provider:${provider.id}`;

    if (provider.id === BASIC_PROVIDER_ID) {
      const matches =
        !query ||
        [provider.label, 'tlon'].some((value) =>
          value.toLowerCase().includes(query)
        );
      return matches
        ? [
            {
              key,
              title: 'Included with Tlon',
              rows: provider.models.map((model) => ({
                key: `${provider.id}:${model.id}`,
                title: getModelDisplayName(model),
                // Tlon picks the model behind this option, so a bot on it may
                // report a different id than the one listed here.
                selected: selection.provider === provider.id,
                onPress: () => onSelect(provider.id, model.id),
              })),
            },
          ]
        : [];
    }

    const zdrOnly = provider.id === ZDR_PROVIDER_ID && zdr.enabled;
    const zdrRow: SettingsRowModel[] =
      provider.id === ZDR_PROVIDER_ID
        ? [
            {
              key: `${provider.id}:zdr`,
              title: 'Zero data retention',
              subtitle: zdr.enabled
                ? 'Showing only models with eligible ZDR endpoints.'
                : 'Only use endpoints that retain no data.',
              disabled:
                zdr.loading || (!zdr.enabled && zdr.modelIds.size === 0),
              toggle: { value: zdr.enabled, onValueChange: onToggleZdr },
            },
          ]
        : [];

    if (provider.loading || (zdrOnly && zdr.loading)) {
      return query
        ? []
        : [
            {
              key,
              title: provider.label,
              rows: [...zdrRow, noteRow('loading', 'Loading models…')],
            },
          ];
    }
    if (provider.error) {
      return query
        ? []
        : [
            {
              key,
              title: provider.label,
              rows: [...zdrRow, noteRow('error', provider.error)],
            },
          ];
    }

    const eligible = zdrOnly
      ? provider.models.filter((model) => zdr.modelIds.has(model.id))
      : provider.models;
    const providerMatches = provider.label.toLowerCase().includes(query);
    const matching =
      !query || providerMatches
        ? eligible
        : eligible.filter((model) =>
            [getModelDisplayName(model), model.id].some((value) =>
              value.toLowerCase().includes(query)
            )
          );
    if (query && matching.length === 0) {
      return [];
    }

    const rank = (model: TlawnProviderModel) =>
      isSelected(model)
        ? -1
        : (recommendedRank.get(model.id) ?? Number.MAX_SAFE_INTEGER);
    const ordered = matching
      .map((model, index) => ({ model, index }))
      .sort(
        (left, right) =>
          rank(left.model) - rank(right.model) || left.index - right.index
      )
      .map(({ model }) => model);

    // Hiding a single model behind "See all" would save nothing.
    const collapsed =
      !query &&
      !expandedProviders.has(provider.id) &&
      ordered.length > COLLAPSED_MODEL_COUNT + 1;
    const visible = ordered.slice(
      0,
      collapsed ? COLLAPSED_MODEL_COUNT : MAX_VISIBLE_MODELS
    );

    const modelRows = visible.map<SettingsRowModel>((model) => {
      const title = getModelDisplayName(model);
      const price = formatBlendedPrice(
        zdrOnly
          ? (zdr.prices.get(model.id) ?? null)
          : blendedPricePerMillion(
              model.pricing?.prompt,
              model.pricing?.completion
            ),
        zdrOnly
      );
      const tags = [
        recommendedRank.has(model.id) ? 'Recommended' : null,
        zdrOnly ? 'ZDR' : null,
      ].filter(Boolean);
      return {
        key: `${provider.id}:${model.id}`,
        title,
        subtitle:
          [model.id === title ? null : model.id, price]
            .filter(Boolean)
            .join(' · ') || undefined,
        value: tags.length > 0 ? tags.join(' · ') : undefined,
        selected: isSelected(model),
        onPress: () => onSelect(provider.id, model.id),
      };
    });

    return [
      {
        key,
        title: provider.label,
        footer: collapsed
          ? undefined
          : hiddenModelsNote(ordered.length - visible.length),
        rows: [
          ...zdrRow,
          ...(modelRows.length > 0
            ? modelRows
            : [noteRow('empty', 'No models available.')]),
          ...(collapsed
            ? [
                {
                  key: `${provider.id}:more`,
                  title: `See all ${ordered.length} models`,
                  action: true,
                  onPress: () => onExpand(provider.id),
                },
              ]
            : []),
        ],
      },
    ];
  });

  if (sections.length > 0) {
    return sections;
  }
  return [
    {
      key: 'empty',
      rows: [
        noteRow(
          'empty',
          providers.length === 0
            ? 'No providers configured.'
            : 'No models found.'
        ),
      ],
    },
  ];
}
