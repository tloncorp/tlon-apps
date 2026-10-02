import { describe, expect, it, vi } from 'vitest';

import {
  BASIC_DEFAULT_MODEL,
  BASIC_PROVIDER_ID,
  BASIC_PROVIDER_LABEL,
  BASIC_PROVIDER_MODEL,
} from './constants';
import {
  COLLAPSED_MODEL_COUNT,
  type ModelPickerProvider,
  buildDefaultModelSections,
} from './modelPicker';

const provider = (
  id: string,
  label: string,
  modelIds: string[],
  overrides: Partial<ModelPickerProvider> = {}
): ModelPickerProvider => ({
  id,
  label,
  models: modelIds.map((modelId) => ({
    id: modelId,
    name: `Model ${modelId}`,
  })),
  loading: false,
  error: null,
  ...overrides,
});

const basic: ModelPickerProvider = {
  id: BASIC_PROVIDER_ID,
  label: BASIC_PROVIDER_LABEL,
  models: [BASIC_PROVIDER_MODEL],
  loading: false,
  error: null,
};

const manyIds = Array.from({ length: 12 }, (_, index) => `m${index + 1}`);

function build(
  overrides: Partial<Parameters<typeof buildDefaultModelSections>[0]> = {}
) {
  const handlers = {
    onSelect: vi.fn(),
    onExpand: vi.fn(),
    onToggleZdr: vi.fn(),
  };
  const sections = buildDefaultModelSections({
    providers: [basic, provider('anthropic', 'Anthropic', manyIds)],
    selection: { provider: BASIC_PROVIDER_ID, model: BASIC_DEFAULT_MODEL },
    search: '',
    expandedProviders: new Set(),
    recommendedRank: new Map(),
    zdr: {
      enabled: false,
      loading: false,
      modelIds: new Set(),
      prices: new Map(),
    },
    ...handlers,
    ...overrides,
  });
  return { sections, ...handlers };
}

const titles = (rows: { title: string }[]) => rows.map((row) => row.title);

describe('buildDefaultModelSections', () => {
  it('lists Tlon’s own model first, as a choice that picks it', () => {
    const { sections, onSelect } = build();

    expect(sections[0].title).toBe('Included with Tlon');
    expect(sections[0].rows).toHaveLength(1);
    expect(sections[0].rows[0].selected).toBe(true);
    sections[0].rows[0].onPress?.();
    expect(onSelect).toHaveBeenCalledWith(
      BASIC_PROVIDER_ID,
      BASIC_DEFAULT_MODEL
    );
  });

  it('marks Tlon’s model as current whatever model id the bot reports', () => {
    const { sections } = build({
      selection: { provider: BASIC_PROVIDER_ID, model: 'openai/some-newer-id' },
    });

    expect(sections[0].rows[0].selected).toBe(true);
  });

  it('shows a long catalog’s first models, then a row that opens the rest', () => {
    const { sections, onExpand } = build();
    const rows = sections[1].rows;

    expect(rows).toHaveLength(COLLAPSED_MODEL_COUNT + 1);
    expect(rows.at(-1)?.title).toBe('See all 12 models');
    rows.at(-1)?.onPress?.();
    expect(onExpand).toHaveBeenCalledWith('anthropic');
  });

  it('shows the whole catalog once it is opened', () => {
    const { sections } = build({ expandedProviders: new Set(['anthropic']) });

    expect(sections[1].rows).toHaveLength(12);
  });

  it('does not hide a single model behind "See all"', () => {
    const { sections } = build({
      providers: [
        provider(
          'anthropic',
          'Anthropic',
          manyIds.slice(0, COLLAPSED_MODEL_COUNT + 1)
        ),
      ],
    });

    expect(sections[0].rows).toHaveLength(COLLAPSED_MODEL_COUNT + 1);
    expect(sections[0].rows.every((row) => !row.action)).toBe(true);
  });

  it('puts the current model first, then recommended ones', () => {
    const { sections } = build({
      selection: { provider: 'anthropic', model: 'm9' },
      recommendedRank: new Map([
        ['m7', 1],
        ['m4', 0],
      ]),
    });
    const rows = sections[1].rows;

    expect(titles(rows).slice(0, 4)).toEqual([
      'Model m9',
      'Model m4',
      'Model m7',
      'Model m1',
    ]);
    expect(rows[0].selected).toBe(true);
    expect(rows[1].value).toBe('Recommended');
  });

  it('searches every provider by model name or id', () => {
    const { sections } = build({
      providers: [
        basic,
        provider('anthropic', 'Anthropic', manyIds),
        provider('openai', 'OpenAI', ['m12', 'other']),
      ],
      search: 'M12',
    });

    expect(sections.map((section) => section.title)).toEqual([
      'Anthropic',
      'OpenAI',
    ]);
    expect(sections.flatMap((section) => titles(section.rows))).toEqual([
      'Model m12',
      'Model m12',
    ]);
  });

  it('shows all of a provider’s models when the search names the provider', () => {
    const { sections } = build({ search: 'anthro' });

    expect(sections).toHaveLength(1);
    expect(sections[0].rows).toHaveLength(12);
  });

  it('finds Tlon’s model by its name, its id, or the id the bot reports', () => {
    const tlonTitles = (search: string, model = BASIC_DEFAULT_MODEL) =>
      build({ search, selection: { provider: BASIC_PROVIDER_ID, model } })
        .sections.filter((section) => section.title === 'Included with Tlon')
        .flatMap((section) => titles(section.rows));

    expect(tlonTitles('luna')).toEqual([BASIC_PROVIDER_LABEL]);
    expect(tlonTitles(BASIC_DEFAULT_MODEL)).toEqual([BASIC_PROVIDER_LABEL]);
    expect(tlonTitles('newer-id', 'openai/some-newer-id')).toEqual([
      BASIC_PROVIDER_LABEL,
    ]);
    expect(tlonTitles('zzz')).toEqual([]);
  });

  it('says so when a search finds nothing', () => {
    const { sections } = build({ search: 'zzz' });

    expect(sections).toHaveLength(1);
    expect(titles(sections[0].rows)).toEqual(['No models found.']);
  });

  it('narrows OpenRouter to ZDR models and tags them', () => {
    const { sections, onToggleZdr } = build({
      providers: [provider('openrouter', 'OpenRouter', ['a', 'b', 'c'])],
      zdr: {
        enabled: true,
        loading: false,
        modelIds: new Set(['b']),
        prices: new Map([['b', 2]]),
      },
    });
    const [zdrRow, ...modelRows] = sections[0].rows;

    expect(zdrRow.toggle?.value).toBe(true);
    zdrRow.toggle?.onValueChange(false);
    expect(onToggleZdr).toHaveBeenCalledWith(false);
    expect(titles(modelRows)).toEqual(['Model b']);
    expect(modelRows[0].value).toBe('ZDR');
    expect(modelRows[0].subtitle).toBe('b · from $2 / 1m');
  });

  it('shows a provider’s loading and error states in its section', () => {
    const { sections } = build({
      providers: [
        provider('anthropic', 'Anthropic', [], { loading: true }),
        provider('openai', 'OpenAI', [], { error: 'Key rejected.' }),
      ],
    });

    expect(titles(sections[0].rows)).toEqual(['Loading models…']);
    expect(titles(sections[1].rows)).toEqual(['Key rejected.']);
  });

  it('says so when no provider is set up', () => {
    const { sections } = build({ providers: [] });

    expect(titles(sections[0].rows)).toEqual(['No providers configured.']);
  });
});
