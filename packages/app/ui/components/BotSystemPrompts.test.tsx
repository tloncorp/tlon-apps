import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as api from '@tloncorp/api';
import React from 'react';
import { useController } from 'react-hook-form';
import { act, create } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../test/sheetTestUtils';

import {
  BotSystemPromptEditorSheet,
  useHasBotPromptFiles,
  useIsOwnedBot,
} from './BotSystemPrompts';

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
  Text: 'Text',
  useIsWindowNarrow: () => true,
  useToast: () => vi.fn(),
}));
vi.mock('tamagui', () => ({
  ScrollView: 'ScrollView',
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
vi.mock('./NotebookPost/NotebookPost', () => ({
  NotebookContentRenderer: 'NotebookContentRenderer',
}));

setupReactTestEnvironment();

const block = (version: string) =>
  `<!-- idempotency-marker:tlon-runtime:${version} -->\n\n## Who You Are\n<!-- /idempotency-marker -->`;

let queryClient: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient();
  mocks.deskSupports = null;
  mocks.deskListeners.clear();
  mocks.minted = 0;
  mocks.files = {
    '~bot-a': { 'SOUL.md': `a soul\n${block('v10')}\n` },
    '~bot-b': {},
  };
});

// A host element the renderer keeps, carrying the hooks' results as props.
const Probe = 'Probe' as unknown as React.ComponentType<
  ReturnType<typeof useIsOwnedBot> & { hasPromptFiles: boolean; testID: string }
>;

function Signals({ botShip }: { botShip: string }) {
  return (
    <Probe
      testID="signals"
      hasPromptFiles={useHasBotPromptFiles(botShip)}
      {...useIsOwnedBot(botShip)}
    />
  );
}

async function renderSignals(botShip: string) {
  queryClient.setQueryData(['stewardPrompts', '~owner'], mocks.files);
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <QueryClientProvider client={queryClient}>
        <Signals botShip={botShip} />
      </QueryClientProvider>
    );
  });
  return () => tree.root.find((node) => node.props.testID === 'signals').props;
}

describe('useHasBotPromptFiles', () => {
  it('is true only for a bot with mirrored files', async () => {
    expect((await renderSignals('~bot-a'))()).toMatchObject({
      hasPromptFiles: true,
      isOwnedBot: true,
    });
    // Owned, but synced with no files: nothing to link to.
    expect((await renderSignals('~bot-b'))()).toMatchObject({
      hasPromptFiles: false,
      isOwnedBot: true,
    });
    expect((await renderSignals('~stranger'))()).toMatchObject({
      hasPromptFiles: false,
      isOwnedBot: false,
    });
  });

  it('drops a cached projection once the desk stops supporting prompts', async () => {
    const signals = await renderSignals('~bot-a');
    expect(signals()).toMatchObject({ hasPromptFiles: true, isOwnedBot: true });

    // A rollback below the prompts module: the cache is still fresh.
    await act(async () => {
      mocks.deskSupports = false;
      mocks.deskListeners.forEach((listener) => listener());
    });
    expect(signals()).toMatchObject({
      hasPromptFiles: false,
      isOwnedBot: false,
      isPending: false,
    });
  });
});

const editor = (tree: ReactTestRenderer) =>
  tree.root.findAll((node) => node.props.testID === 'BotSystemPromptEditor');

const sheet = (text: string) => (
  <BotSystemPromptEditorSheet
    botShip="~bot-a"
    prompt={{ name: 'SOUL.md', text }}
    changedElsewhere={false}
    onClose={vi.fn()}
    onSaved={vi.fn()}
  />
);

async function renderSheet(text: string) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(sheet(text));
  });
  return tree;
}

async function save(tree: ReactTestRenderer) {
  await act(async () => {
    tree.root
      .find((node) => node.props.testID === 'BotSystemPromptSave')
      .props.onPress();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('BotSystemPromptEditorSheet', () => {
  it("edits only the owner's text and saves it beside Tlon's block", async () => {
    mocks.setStewardPrompt.mockResolvedValue({});
    const tree = await renderSheet(`Call me Captain.\n${block('v10')}\n`);
    expect(editor(tree)[0].props.value).toBe('Call me Captain.');

    act(() => {
      editor(tree)[0].props.onChange('Call me Admiral.');
    });
    await save(tree);

    expect(mocks.setStewardPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'SOUL.md',
        text: `Call me Admiral.\n${block('v10')}\n`,
      })
    );
  });

  it('keeps a Tlon block that was refreshed while the draft was open', async () => {
    mocks.setStewardPrompt.mockResolvedValue({});
    const tree = await renderSheet(`${block('v10')}\n`);
    act(() => {
      editor(tree)[0].props.onChange('Call me Captain.');
    });
    // A gateway restart republished the block mid-edit.
    await act(async () => {
      tree.update(sheet(`${block('v11')}\n`));
    });
    expect(editor(tree)[0].props.value).toBe('Call me Captain.');
    await save(tree);

    expect(mocks.setStewardPrompt.mock.calls[0][0].text).toBe(
      `Call me Captain.\n${block('v11')}\n`
    );
  });

  it('re-renders the preview when a live projection replaces the additions', async () => {
    const tree = await renderSheet(`a soul\n${block('v10')}\n`);
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
      tree.update(sheet(`a soul, revised\n${block('v10')}\n`));
    });
    expect(preview()).toEqual(['a soul, revised']);
  });

  it('resends an unanswered save under its id, and a settled one under a new id', async () => {
    const tree = await renderSheet(`${block('v10')}\n`);
    act(() => {
      editor(tree)[0].props.onChange('new soul');
    });
    const sentIds = () =>
      mocks.setStewardPrompt.mock.calls.map(([params]) => params.requestId);

    // The POST may have reached the ship; only its answer was lost.
    mocks.setStewardPrompt.mockRejectedValueOnce(new Error('network'));
    await save(tree);
    // The ship answered: that request is settled.
    mocks.setStewardPrompt.mockRejectedValueOnce(
      new api.StewardPromptEditError('0v1', {
        type: 'error',
        errorType: 'harness-error',
        message: [],
      })
    );
    await save(tree);
    mocks.setStewardPrompt.mockResolvedValueOnce({
      requestId: '0v2',
      name: 'SOUL.md',
    });
    await save(tree);

    expect(sentIds()).toEqual(['0v1', '0v1', '0v2']);
  });
});
