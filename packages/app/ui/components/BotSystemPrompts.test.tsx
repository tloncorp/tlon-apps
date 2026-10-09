import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as api from '@tloncorp/api';
import React from 'react';
import { useController } from 'react-hook-form';
import { act, create } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../test/sheetTestUtils';

import { BotSystemPromptsSection, useIsOwnedBot } from './BotSystemPrompts';

const mocks = vi.hoisted(() => ({
  files: {} as Record<string, Record<string, string>>,
  setStewardPrompt: vi.fn(),
  deskSupports: null as boolean | null,
  deskListeners: new Set<() => void>(),
  minted: 0,
}));

vi.mock('@tloncorp/api', () => ({
  getStewardPromptFiles: async () => mocks.files,
  subscribeToStewardPrompts: async () => 1,
  unsubscribe: vi.fn(),
  onDeskSupportsStewardPromptsChange: (listener: () => void) => {
    mocks.deskListeners.add(listener);
    return () => mocks.deskListeners.delete(listener);
  },
  getDeskSupportsStewardPromptsState: () => mocks.deskSupports,
  setStewardPrompt: mocks.setStewardPrompt,
  awaitStewardPromptRequest: vi.fn(),
  mintRequestId: () => `0v${++mocks.minted}`,
  StewardPromptEditError: class extends Error {},
  StewardPromptPendingError: class extends Error {},
  PromptsUnsupportedError: class extends Error {},
  DeskUnsupportedError: class extends Error {},
}));
vi.mock('@tloncorp/shared', () => ({
  markdownToStory: (markdown: string) => markdown,
  convertContent: (story: string) => [story],
}));
vi.mock('@tloncorp/ui', () => ({
  Button: 'Button',
  Icon: () => null,
  Pressable: 'Pressable',
  Text: 'Text',
  useIsWindowNarrow: () => true,
  useToast: () => vi.fn(),
}));
vi.mock('tamagui', () => ({
  ScrollView: 'ScrollView',
  View: 'View',
  XStack: 'XStack',
  YStack: 'YStack',
}));
vi.mock('react-native', () => ({ Keyboard: { dismiss: vi.fn() } }));
vi.mock('../contexts/appDataContext', () => ({
  useCurrentUserId: () => '~owner',
}));
vi.mock('./ActionSheet', async () => {
  const { Passthrough } = await import('../../test/sheetTestUtils');
  return {
    ActionSheet: Object.assign(Passthrough, {
      ScrollableContent: Passthrough,
      FormBlock: Passthrough,
    }),
  };
});
vi.mock('./Form', () => ({
  ControlledTextareaField: ({
    control,
    name,
    inputProps,
  }: {
    control: never;
    name: string;
    inputProps: Record<string, unknown>;
  }) => {
    const { field } = useController({ control, name });
    return (
      <textarea
        {...inputProps}
        value={field.value}
        onChange={(text: unknown) => field.onChange(text)}
      />
    );
  },
}));
vi.mock('./ListItem', async () => {
  const { Passthrough } = await import('../../test/sheetTestUtils');
  return {
    ListItem: Object.assign(Passthrough, {
      MainContent: Passthrough,
      Title: Passthrough,
      Subtitle: Passthrough,
    }),
  };
});
vi.mock('./NotebookPost/NotebookPost', () => ({
  NotebookContentRenderer: 'NotebookContentRenderer',
}));
vi.mock('./SettingsSection', async () => {
  const { Passthrough, Empty } = await import('../../test/sheetTestUtils');
  return { SettingsSection: Passthrough, SettingsDivider: Empty };
});

setupReactTestEnvironment();

let queryClient: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient();
  mocks.deskSupports = null;
  mocks.deskListeners.clear();
  mocks.minted = 0;
  mocks.files = {
    '~bot-a': { 'SOUL.md': 'a soul' },
    '~bot-b': { 'SOUL.md': 'b soul' },
  };
});

// A host element the renderer keeps, carrying the hook's result as props.
const OwnershipProbe = 'OwnershipProbe' as unknown as React.ComponentType<
  ReturnType<typeof useIsOwnedBot> & { testID: string }
>;

function Ownership({ botShip }: { botShip: string }) {
  return <OwnershipProbe testID="ownership" {...useIsOwnedBot(botShip)} />;
}

const section = (botShip: string) => (
  <QueryClientProvider client={queryClient}>
    <BotSystemPromptsSection botShip={botShip} />
    <Ownership botShip={botShip} />
  </QueryClientProvider>
);

async function render(botShip: string) {
  // Seeded so the first render already has the projection to list.
  queryClient.setQueryData(['stewardPrompts', '~owner'], mocks.files);
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(section(botShip));
  });
  return tree;
}

function openPersonality(tree: ReactTestRenderer) {
  act(() => {
    tree.root
      .find(
        (node) => node.props.accessibilityLabel === 'Edit Personality prompt'
      )
      .props.onPress();
  });
}

const editor = (tree: ReactTestRenderer) =>
  tree.root.findAll((node) => node.props.testID === 'BotSystemPromptEditor');

describe('BotSystemPromptsSection', () => {
  it('closes a draft rather than carry it to another bot', async () => {
    const tree = await render('~bot-a');
    openPersonality(tree);
    act(() => {
      editor(tree)[0].props.onChange('draft for a');
    });
    expect(editor(tree)[0].props.value).toBe('draft for a');

    // The profile screen is reused for another bot whose file shares the name.
    await act(async () => {
      tree.update(section('~bot-b'));
    });
    expect(editor(tree)).toHaveLength(0);

    openPersonality(tree);
    expect(editor(tree)[0].props.value).toBe('b soul');
    expect(mocks.setStewardPrompt).not.toHaveBeenCalled();
  });

  it('re-renders the preview when a live projection replaces the text', async () => {
    const tree = await render('~bot-a');
    openPersonality(tree);
    act(() => {
      tree.root
        .find((node) => node.props.testID === 'BotSystemPromptPreviewToggle')
        .props.onPress();
    });
    const preview = () =>
      tree.root.find(
        (node) => node.props.testID === 'BotSystemPromptPreviewContent'
      ).props.content;
    expect(preview()).toEqual(['a soul']);

    await act(async () => {
      queryClient.setQueryData(['stewardPrompts', '~owner'], {
        '~bot-a': { 'SOUL.md': 'a soul, revised' },
      });
      // React Query notifies its observers on a timer tick.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(preview()).toEqual(['a soul, revised']);
  });

  it('drops a cached projection once the desk stops supporting prompts', async () => {
    const tree = await render('~bot-a');
    const ownership = () =>
      tree.root.find((node) => node.props.testID === 'ownership').props;
    expect(ownership()).toMatchObject({ isOwnedBot: true });

    // A rollback below the prompts module: the cache is still fresh.
    await act(async () => {
      mocks.deskSupports = false;
      mocks.deskListeners.forEach((listener) => listener());
    });
    expect(
      tree.root.findAll(
        (node) => node.props.accessibilityLabel === 'Edit Personality prompt'
      )
    ).toHaveLength(0);
    expect(ownership()).toMatchObject({ isOwnedBot: false, isPending: false });
  });

  it('resends an unanswered save under its id, and a settled one under a new id', async () => {
    const tree = await render('~bot-a');
    openPersonality(tree);
    act(() => {
      editor(tree)[0].props.onChange('new soul');
    });
    const save = async () => {
      await act(async () => {
        tree.root
          .find((node) => node.props.testID === 'BotSystemPromptSave')
          .props.onPress();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    };
    const sentIds = () =>
      mocks.setStewardPrompt.mock.calls.map(([params]) => params.requestId);

    // The POST may have reached the ship; only its answer was lost.
    mocks.setStewardPrompt.mockRejectedValueOnce(new Error('network'));
    await save();
    // The ship answered: that request is settled.
    mocks.setStewardPrompt.mockRejectedValueOnce(
      new api.StewardPromptEditError('0v1', {
        type: 'error',
        errorType: 'harness-error',
        message: [],
      })
    );
    await save();
    mocks.setStewardPrompt.mockResolvedValueOnce({
      requestId: '0v2',
      name: 'SOUL.md',
    });
    await save();

    expect(sentIds()).toEqual(['0v1', '0v1', '0v2']);
    expect(editor(tree)).toHaveLength(0);
  });
});
