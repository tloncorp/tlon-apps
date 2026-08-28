import { convertContent, markdownToStory } from '@tloncorp/shared/logic';
import { expect, test, vi } from 'vitest';

import { listItemMarkerType } from './BlockRenderer';

// BlockRenderer pulls in the native/expo rendering stack. Stub the leaf
// native modules and the component subtrees so the module graph loads
// without rendering anything.
vi.mock('@tloncorp/shared', () => ({
  AnalyticsEvent: {},
  trackEvent: vi.fn(),
  useMutableCallback: (cb: unknown) => cb,
  useMutableRef: () => ({ current: null }),
}));

vi.mock('@tloncorp/ui', () => ({
  Button: () => null,
  GestureTrigger: () => null,
  Icon: () => null,
  Image: () => null,
  Pressable: () => null,
  Text: () => null,
  useCopy: () => ({ doCopy: () => {}, didCopy: false }),
}));

vi.mock('expo-image', () => ({}));
vi.mock('react-native-gesture-handler', () => ({
  Gesture: {},
  GestureDetector: () => null,
  ScrollView: () => null,
}));
vi.mock('tamagui', () => {
  const styledComponent: any = () => null;
  styledComponent.styleable = () => styledComponent;
  return {
    ScrollView: () => null,
    Text: () => null,
    View: () => null,
    XStack: () => null,
    YStack: () => null,
    createStyledContext: () => ({ Provider: () => null }),
    styled: () => styledComponent,
    withStaticProperties: (component: any, statics: any) =>
      Object.assign(component, statics),
  };
});

vi.mock('../../contexts/nowPlaying', () => ({
  useNowPlayingController: () => ({}),
}));
vi.mock('../AudioRecorder/Waveform', () => ({ Waveform: () => null }));
vi.mock('../FileUploadPreview', () => ({ FileUploadPreview: () => null }));
vi.mock('../KitCard', () => ({ KitCard: () => null }));
vi.mock('../VideoPreview', () => ({ VideoPreview: () => null }));
vi.mock('./InlineRenderer', () => ({ InlineRenderer: () => null }));

function firstList(markdown: string) {
  const block = convertContent(markdownToStory(markdown), null).find(
    (b) => b.type === 'list'
  );
  if (!block || block.type !== 'list') {
    throw new Error('expected a list block');
  }
  return block.list;
}

function childMarkerTypes(markdown: string) {
  const list = firstList(markdown);
  return (list.children ?? []).map((child) =>
    listItemMarkerType(list.type ?? 'unordered', child)
  );
}

// Task item first, deliberately: this branch's base converter classifies a list by its first item, while the incoming #6216 converter classifies by any task item; task-first produces the mixed tasklist shape under both rules, so this fixture stays stable across that merge (plain-first would classify unordered here and even lose the checkbox).
const mixedList = firstList('- [x] done\n- plain');

test('mixed list converts to a tasklist with two children', () => {
  expect(mixedList.type).toBe('tasklist');
  expect(mixedList.children).toHaveLength(2);
});

test('task item in a mixed list keeps its suppressed marker', () => {
  const children = mixedList.children ?? [];
  expect(listItemMarkerType('tasklist', children[0])).toBe('tasklist');
});

test('plain item in a mixed list gets a bullet', () => {
  const children = mixedList.children ?? [];
  expect(listItemMarkerType('tasklist', children[1])).toBe('unordered');
});

test('homogeneous tasklist children all keep their suppressed markers', () => {
  expect(childMarkerTypes('- [ ] a\n- [x] b')).toEqual([
    'tasklist',
    'tasklist',
  ]);
});

test('homogeneous unordered children all get bullets', () => {
  expect(childMarkerTypes('- a\n- b')).toEqual(['unordered', 'unordered']);
});

test('homogeneous ordered children all keep their numbers', () => {
  expect(childMarkerTypes('1. a\n2. b')).toEqual(['ordered', 'ordered']);
});
