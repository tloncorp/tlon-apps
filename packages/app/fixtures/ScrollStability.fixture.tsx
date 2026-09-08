import type { LegendListRef } from '@legendapp/list/react-native';
import { HeaderHeightContext } from '@react-navigation/elements';
import { ChannelContentConfiguration } from '@tloncorp/api';
import {
  DraftInputId,
  PostContentRendererId,
  queryClient,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { File, Paths } from 'expo-file-system';
import { requireOptionalNativeModule } from 'expo-modules-core';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from 'react';
import {
  Button,
  Dimensions,
  Keyboard,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
} from 'react-native';

import { ChatMessage } from '../ui/components/ChatMessage';
import { ChatInput } from '../ui/components/draftInputs/ChatInput';
import type { DraftInputContext } from '../ui/components/draftInputs/shared';
import {
  ConversationListDiagnosticsContext,
  type ConversationListDiagnostics,
} from '../ui/components/Channel/PostList/diagnostics';
import type { PostListMethods } from '../ui/components/Channel/PostList/shared';
import {
  ComponentsKitContext,
  useComponentsKitContext,
} from '../ui/contexts/componentsKits';
import { ChannelFixture } from './Channel.fixture';
import { ScrollStabilityScreenHost } from './ScrollStabilityScreenHost';
import { block, verse, referencedChatPost } from './contentHelpers';
import { createFakePost, initialContacts, tlonLocalIntros } from './fakeData';
import {
  assessAnchorTrace,
  assessScrollTrace,
  assessScrollPreconditions,
  hasThinkingMotionOverlap,
  type ScrollPreconditions,
  type ScrollTraceExpectations,
  chooseReadingAnchor,
  type ScrollSnapshot,
} from './scrollStabilityTrace';
import {
  assessImageLoadWitness,
  imageGestureDisplacementErrorPt,
  type ImageLoadGate,
  type ImageLoadInteraction,
} from './scrollStabilityImageLoad';

import {
  assessRowMutationWitness,
  rowMutationContractFingerprint,
  type RowMutationContract,
  type RowMutationEvidence,
  type RowMutationSemanticSample,
  type RowMutationState,
} from './scrollStabilityMutation';

import {
  adaptNativeScrollGeometry,
  nativeThinkingGestureExtentIsMeasured,
  adaptBufferedNativeScrollGeometry,
  type NativeGeometryRequest,
  type NativeSampledRulerContract,
} from './scrollNativeGeometry';
import {
  assessNativeRecording,
  type NativeRecordingContract,
} from './scrollNativeRecording';
import type { NativeEntryContract } from './scrollNativeEntryTrace';
import type { NativeMutationContract } from './scrollNativeMutationTrace';
import { positionFixtureList } from './scrollFixturePosition';
import {
  nativeCenterCommand,
  nativeCenterCommandEvidenceIssues,
  type NativeCenterCommandContract,
  nativeOffscreenCommand,
  nativeOffscreenCommandEvidenceIssues,
  type NativeOffscreenCommandContract,
} from './scrollNativeTargetCommand';
import {
  observeScrollCorrections,
  type ScrollCorrectionRecording,
} from './scrollCorrectionDiagnostics';
import {
  automatedScrollScenarios as automatedScenarios,
  declareFixtureSampledRuler,
  selectFixtureSuiteScenarios,
  parseFixtureSuiteRequest,
  parseFixtureCorrectionDiagnostics,
  parseFixtureNativeReadTimingSession,
} from './scrollFixtureCaptureContract';

type NativeEntryActionMarkers = {
  reset: () => Promise<void>;
  data: () => Promise<void>;
};

type NativeRecordingModule = {
  startScrollGeometryItineraryRecording?: (
    id: string,
    itineraryJSON: string,
    rowPrefix: string,
    composer: string,
    durationMs: number,
    maximumFrames: number
  ) => Promise<{ status: string; recordingId?: string }>;
  startScrollGeometryRecording: (
    id: string,
    root: string,
    scroll: string,
    rowPrefix: string,
    composer: string,
    durationMs: number,
    maximumFrames: number
  ) => Promise<{ status: string; recordingId?: string }>;
  markScrollGeometryRecording: (id: string, name: string) => Promise<unknown>;
  stopScrollGeometryRecording: (id: string) => Promise<unknown>;
};

// The host runner records commit, dirty snapshot and installed artifact beside results.
const FIXTURE_VERSION = 2;
const NATIVE_ROOT_ID = 'scroll-stability-native-root';
const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
const imageURI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const description =
  'A deliberately mixed-height conversation. Keep this message in the same place while the content around it changes. ';
const noop = () => {};
const assetOrigin = 'http://127.0.0.1:8337';
// PostView's legacy channel fallback bypasses the component kit. Explicit
// defaults select the measured real ChatMessage without changing chat flags.
const fixtureChannel: db.Channel = {
  ...tlonLocalIntros,
  contentConfiguration: ChannelContentConfiguration.defaultConfiguration(),
};
async function assetRequest(path: string, method = 'GET') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch(`${assetOrigin}${path}`, {
      method,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Asset gate returned ${response.status}`);
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function makePost(index: number, expanded = false): db.Post {
  const text = `Message ${index}. ${description.repeat(expanded ? 18 : index % 9 === 0 ? 8 : 1)}`;
  const content =
    index % 13 === 0
      ? [
          block.code(
            `// Message ${index}\n${'const value = await readMessage();\n'.repeat(expanded ? 22 : 5)}`,
            'typescript'
          ),
        ]
      : [verse.inline(text)];
  return createFakePost('chat', JSON.stringify(content), undefined, {
    id: `scroll-fixture-${index}`,
    sentAt: 1_780_000_000_000 + index * 60_000,
    receivedAt: 1_780_000_000_000 + index * 60_000,
    textContent: text,
    authorId: initialContacts[index % 2].id,
    author: initialContacts[index % 2],
    replyCount: 0,
    reactions: [],
    hidden: false,
    channelId: tlonLocalIntros.id,
  });
}

type FixtureEvent = {
  time: number;
  name: string;
  values?: Record<string, number | string | boolean>;
};
type Trace = {
  scenario: string;
  runId: string;
  assertion: 'hold' | 'observe' | 'bottom' | 'target' | 'gesture';
  productCoverage: 'local-component-fixture';
  thinkingCoverage?: 'forced-label-layout-only';
  positioningCoverage?: 'programmatic-near-end-no-user-drag';
  imageLoadGate?: ImageLoadGate;
  imageLoadWitness?: ReturnType<typeof assessImageLoadWitness>;
  imageLoadInteraction?: ImageLoadInteraction;
  baseline: ScrollSnapshot;
  samples: ScrollSnapshot[];
  events: FixtureEvent[];
  assessment: ReturnType<typeof assessAnchorTrace> | null;
  fixtureVersion: number;
  assertionSchemaVersion: 1;
  nativeGeometrySchemaVersion?: 1;
  nativeSampledRulerContract?: NativeSampledRulerContract;
  nativeLatestVisibilityInputs?: {
    source: 'React Native Dimensions.get(window).height';
    before: { windowHeight: number; atBottomThreshold: 1 };
    after: { windowHeight: number; atBottomThreshold: 1 };
    changes: { time: number; windowHeight: number }[];
  };
  nativeRecording?: unknown;
  nativeCorrections?: ScrollCorrectionRecording;
  nativeCenterCommandContract?: NativeCenterCommandContract;
  nativeOffscreenCommandContract?: NativeOffscreenCommandContract;
  nativeRecordingContract?: NativeRecordingContract;
  nativeEntryContract?: NativeEntryContract;
  nativePostGestureProbe?: {
    contract: {
      version: 1;
      recordingId: string;
      scope: string;
      outcome: 'end' | 'away';
      declaredAt: number;
      probeId: string;
      quietTailMs: 1000;
      tolerancePt: 1;
    };
    armedAt?: number;
    completion?: FixtureEvent;
    baseline?: ScrollSnapshot;
    anchorKey?: string;
    markerTransfers: {
      name: string;
      requestedAt: number;
      receivedAt: number;
      clock: 'performance.now milliseconds';
    }[];
  };
  nativeMutationContract?: NativeMutationContract;
  nativeMutationMarkerTransfer?: {
    name: string;
    requestedAt: number;
    receivedAt: number;
    clock: 'performance.now milliseconds';
  };
  nativeEntryMarkerTransfers?: {
    name: string;
    requestedAt: number;
    receivedAt: number;
    clock: 'performance.now milliseconds';
  }[];
  nativeRecordingAcquisition?: {
    verdict: string;
    issues: { code: string; frame?: number }[];
    samples: number;
  };
  nativeRecordingTransfer?: {
    startAcknowledgedAt: number;
    earliestStopAt: number;
    requestedAt: number;
    receivedAt: number;
    clock: 'performance.now milliseconds';
  };
  expectations: ScrollTraceExpectations | null;
  baselinePreconditions: ScrollPreconditions;
  followingOffsetThroughout: boolean;
  emptyEndThroughout: boolean;
  committedDataKeys?: string[];
  originalDataKeys: string[];
  baselineComposerHeight?: number;
  mutationEvidence?: RowMutationEvidence;
  mutationScope?: string;
  mutationWitness?: ReturnType<typeof assessRowMutationWitness>;
  imageLoadEvidence?: Parameters<typeof assessImageLoadWitness>[0];
  result: ReturnType<typeof assessScrollTrace> | null;
  platform: string;
};
type Runtime = {
  generation: number;
  row: (key: string, view: View | null, scope: string) => void;
  composer: (view: View | null) => void;
  send: DraftInputContext['sendPostFromDraft'];
  event: (name: string, values?: FixtureEvent['values']) => void;
};
const RuntimeContext = createContext<Runtime | null>(null);
type PreparedRowMutation = {
  key: string;
  kind:
    | 'grow'
    | 'shrink'
    | 'reference'
    | 'media'
    | 'remove'
    | 'reaction'
    | 'reply'
    | 'cache';
  expected: RowMutationState;
  selection: NonNullable<FixtureEvent['values']>;
  apply: () => void;
};
type RawRowCommit = { event: FixtureEvent; state: RowMutationState };
type RawSemanticSnapshot = {
  commit?: RawRowCommit;
  committedKeys: string[];
  valid: boolean;
  durationMs: number;
};

function mutationSignature(post: db.Post) {
  return {
    content: JSON.stringify(post.content ?? ''),
    reactions: JSON.stringify(post.reactions ?? []),
    replies: post.replyCount ?? 0,
  };
}

// Label observed fingerprints with capture ownership. The signature remains
// the one emitted by MeasuredMessage; unknown/stale states remain observable.
function capturedMutationRevision(
  plan: RowMutationContract,
  state: RowMutationState
) {
  const same = (candidate: RowMutationState) =>
    JSON.stringify(candidate) === JSON.stringify(state);
  const expected = plan.phases.find((phase) => same(phase.state));
  if (expected)
    return { requestId: expected.requestId, revision: expected.revision };
  if (same(plan.baseline.state))
    return {
      requestId: plan.baseline.requestId,
      revision: plan.baseline.revision,
    };
  return {
    requestId: 'unrecognized-render-owner',
    revision: `unrecognized:${JSON.stringify(state)}`,
  };
}
function annotateMutationEvent(
  observed: FixtureEvent,
  plan: RowMutationContract
): FixtureEvent {
  const values = observed.values;
  if (
    values?.key !== plan.key ||
    !['row-commit', 'row-detached', 'row-layout'].includes(observed.name)
  )
    return observed;
  const state: RowMutationState =
    observed.name === 'row-detached'
      ? { presence: 'absent' }
      : {
          presence: 'present',
          signature: {
            content: values.content as string,
            reactions: values.reactions as string,
            replies: values.replies as string | number,
          },
        };
  return {
    ...observed,
    values: { ...values, ...capturedMutationRevision(plan, state) },
  };
}

function MeasuredMessage(props: ComponentProps<typeof ChatMessage>) {
  const runtime = useContext(RuntimeContext)!;
  const scope = `${props.post.channelId ?? ''}::${runtime.generation}`;
  const ref = useCallback(
    (view: View | null) => runtime.row(props.post.id, view, scope),
    [runtime, props.post.id, scope]
  );
  // Observe the committed live post received by the real renderer. These
  // fingerprints never come from the fixture's requested replacement object.
  useLayoutEffect(() => {
    runtime.event('row-commit', {
      key: props.post.id,
      scope,
      ...mutationSignature(props.post),
    });
  });
  return (
    <View
      ref={ref}
      collapsable={false}
      onLayout={(e) =>
        runtime.event('row-layout', {
          key: props.post.id,
          scope,
          ...mutationSignature(props.post),
          height: e.nativeEvent.layout.height,
        })
      }
      testID={`scroll-row-${props.post.id}`}
      accessibilityValue={{
        text: JSON.stringify({
          version: 1,
          scope,
          key: props.post.id,
          signature: mutationSignature(props.post),
        }),
      }}
    >
      <ChatMessage {...props} />
    </View>
  );
}

function LocalChatInput({
  draftInputContext,
}: {
  draftInputContext: DraftInputContext;
}) {
  const runtime = useContext(RuntimeContext)!;
  const lastDraft = useRef<string | undefined>(undefined);
  // Keep the real input and placement. Only the fixture send side effect is local.
  const context = useMemo<DraftInputContext>(
    () => ({
      ...draftInputContext,
      sendPostFromDraft: runtime.send,
      storeDraft: async (content, draftType) => {
        const fingerprint = JSON.stringify(content);
        if (fingerprint !== lastDraft.current) {
          lastDraft.current = fingerprint;
          runtime.event('composer-input', { fingerprint });
        }
        await draftInputContext.storeDraft(content, draftType);
      },
    }),
    [draftInputContext, runtime]
  );
  return (
    <View
      ref={runtime.composer}
      testID="scroll-stability-composer"
      collapsable={false}
      onLayout={(e) =>
        runtime.event('composer-layout', {
          height: e.nativeEvent.layout.height,
        })
      }
    >
      <ChatInput draftInputContext={context} />
    </View>
  );
}

function FixtureKit({ children }: { children: React.ReactNode }) {
  const kit = useComponentsKitContext();
  const value = useMemo(
    () => ({
      ...kit,
      renderers: {
        ...kit.renderers,
        [PostContentRendererId.chat]: MeasuredMessage,
      },
      inputs: { ...kit.inputs, [DraftInputId.chat]: LocalChatInput },
    }),
    [kit]
  );
  return (
    <ComponentsKitContext.Provider value={value}>
      {children}
    </ComponentsKitContext.Provider>
  );
}

type Measurable = {
  measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void
  ) => void;
};
function measure(
  view: Measurable | null | undefined
): Promise<{ y: number; height: number } | null> {
  return new Promise((resolve) => {
    if (!view?.measureInWindow) return resolve(null);
    const timer = setTimeout(() => resolve(null), 250);
    view.measureInWindow((_x, y, _width, height) => {
      clearTimeout(timer);
      resolve({ y, height });
    });
  });
}

export function ScrollStabilityFixture() {
  const [posts, setPosts] = useState(() =>
    Array.from({ length: 90 }, (_, i) => makePost(i + 30))
  );
  const [generation, setGeneration] = useState(0);
  const [selectedPostId, setSelectedPostId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [thinking, setThinking] = useState<string | undefined>();
  const [status, setStatus] = useState(
    'Ready: pick a scenario or scroll and type naturally'
  );
  const [panel, setPanel] = useState(false);
  const [media, setMedia] = useState(false);
  const list = useRef<LegendListRef | null>(null);
  const commands = useRef<PostListMethods | null>(null);
  const attachedChannel = useRef<string | null>(null);
  const attachedScrollViewID = useRef<string | null>(null);
  const nativeCaptureSequence = useRef(0);
  const nativeScroll = useRef<NativeScrollEvent | null>(null);
  const nativeMetricsReceivedAt = useRef<number | null>(null);
  const runId = useRef('');
  const suiteRunning = useRef(false);
  const rows = useRef(new Map<string, View>());
  const rowScopes = useRef(new Map<string, string>());
  const renderCommits = useRef(new Map<string, RawRowCommit>());
  const renderSequence = useRef(0);
  const generationRef = useRef(generation);
  generationRef.current = generation;
  const semanticTarget = useRef<{ key: string; scope: string } | null>(null);
  const semanticSnapshots = useRef(
    new WeakMap<ScrollSnapshot, RawSemanticSnapshot>()
  );
  const composer = useRef<View | null>(null);
  const composerHeight = useRef<number | undefined>(undefined);
  const requiredRows = useRef(new Set<string>());
  const thinkingEvidence = useRef({
    visible: false,
    label: '',
    height: 0,
    committedAt: 0,
    laidOutAt: 0,
  });
  const events = useRef<FixtureEvent[]>([]);
  const traces = useRef<Trace[]>([]);
  const correctionsEnabled = useRef(false);
  const correctionObservation = useRef<ReturnType<
    typeof observeScrollCorrections
  > | null>(null);
  const postsRef = useRef(posts);
  const sampling = useRef(false);
  const preparingCapture = useRef(false);
  const disposed = useRef(false);
  const nextIndex = useRef(120);
  postsRef.current = posts;
  const newestFirstPosts = useMemo(() => [...posts].reverse(), [posts]);

  const event = useCallback(
    (
      name: string,
      values?: FixtureEvent['values'],
      recordedAt = performance.now()
    ) => {
      const time = recordedAt;
      let observed = values ? { ...values } : undefined;
      const scopeKey =
        typeof observed?.scope === 'string' && typeof observed.key === 'string'
          ? `${observed.scope}\0${observed.key}`
          : undefined;
      if (scopeKey && (name === 'row-commit' || name === 'row-detached')) {
        observed = {
          ...observed,
          commitId: `render-${++renderSequence.current}`,
        };
        const state: RowMutationState =
          name === 'row-detached'
            ? { presence: 'absent' }
            : {
                presence: 'present',
                signature: {
                  content: String(observed.content),
                  reactions: String(observed.reactions),
                  replies: observed.replies as string | number,
                },
              };
        renderCommits.current.set(scopeKey, {
          event: { time, name, values: observed },
          state,
        });
      } else if (scopeKey && name === 'row-layout') {
        const committed = renderCommits.current.get(scopeKey);
        if (
          committed?.state.presence === 'present' &&
          ['content', 'reactions', 'replies'].every(
            (field) => observed?.[field] === committed.event.values?.[field]
          )
        )
          observed = {
            ...observed,
            commitId: committed.event.values!.commitId,
          };
      }
      if (name === 'composer-layout' && typeof values?.height === 'number') {
        composerHeight.current = values.height;
      }
      if (values?.conversationId === tlonLocalIntros.id) {
        if (name === 'thinking-commit') {
          thinkingEvidence.current.visible = values.visible === true;
          thinkingEvidence.current.label = String(values.label ?? '');
          thinkingEvidence.current.committedAt = time;
        }
        if (name === 'thinking-layout' && typeof values.height === 'number') {
          thinkingEvidence.current.height = values.height;
          thinkingEvidence.current.laidOutAt = time;
        }
      }
      events.current.push({ time, name, values: observed });
      // Keep the active capture intact; clear between independent cases.
      if (!sampling.current && events.current.length > 2000)
        events.current.splice(0, 1000);
    },
    []
  );
  const [nativeReadTimingSession, setNativeReadTimingSession] =
    useState<string>();
  const committedTimingSession = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    committedTimingSession.current = nativeReadTimingSession;
  }, [nativeReadTimingSession]);
  const listDiagnostics = useMemo<ConversationListDiagnostics>(
    () => ({
      ruler: {
        scope: `${fixtureChannel.id}::${generation}`,
        rowMetadata: (post) => ({
          scope: `${post.channelId ?? ''}::${generation}`,
          key: post.id,
          signature: mutationSignature(post),
        }),
      },
      attachMethods: (methods) => {
        commands.current = methods;
        return () => {
          if (commands.current === methods) commands.current = null;
        };
      },
      attach: (ref, channelId, scrollViewTestID) => {
        correctionObservation.current?.dispose();
        const correction = correctionsEnabled.current
          ? observeScrollCorrections(ref, `${channelId}::${generation}`)
          : null;
        correctionObservation.current = correction;
        list.current = ref;
        attachedChannel.current = channelId;
        attachedScrollViewID.current = scrollViewTestID ?? null;
        nativeScroll.current = null;
        nativeMetricsReceivedAt.current = null;
        event('list-attached', { channelId });
        return () => {
          correction?.dispose();
          if (list.current === ref) {
            list.current = null;
            attachedChannel.current = null;
            attachedScrollViewID.current = null;
          }
          event('list-detached');
        };
      },
      event,
      nativeScroll: (value) => {
        nativeScroll.current = value;
        nativeMetricsReceivedAt.current = performance.now();
      },
    }),
    [event, generation]
  );
  const diagnostics = useMemo<ConversationListDiagnostics>(
    () => ({ ...listDiagnostics, nativeReadTimingSession }),
    [listDiagnostics, nativeReadTimingSession]
  );

  const update = useCallback((next: db.Post[]) => {
    // useLivePost reads the global per-post query cache; prop replacement alone
    // would leave previously seeded rows unchanged with staleTime: Infinity.
    for (const post of next) queryClient.setQueryData(['post', post.id], post);
    postsRef.current = next;
    setPosts(next);
  }, []);
  const append = useCallback(async () => {
    const post = makePost(nextIndex.current++);
    event('append', { key: post.id });
    update([...postsRef.current, post]);
  }, [event, update]);
  const runtime = useMemo<Runtime>(
    () => ({
      generation,
      event,
      row: (key, view, scope) => {
        if (view) {
          rows.current.set(key, view);
          rowScopes.current.set(key, scope);
        } else if (
          rowScopes.current.get(key) === scope &&
          rows.current.delete(key)
        ) {
          rowScopes.current.delete(key);
          event('row-detached', { key, scope });
        }
      },
      composer: (view) => {
        composer.current = view;
      },
      send: async (draft) => {
        const surface = commands.current;
        const isCurrent = surface?.captureScrollIntent?.() ?? (() => false);
        event('local-send', {
          content: JSON.stringify(draft),
          productSend: false,
        });
        await append();
        requestAnimationFrame(() => {
          if (isCurrent()) surface?.scrollToEnd({ animated: true });
        });
      },
    }),
    [append, event, generation]
  );

  const declareSampledRuler = useCallback(
    (scenario: string) =>
      declareFixtureSampledRuler(Platform.OS, scenario, {
        scope: attachedChannel.current
          ? `${attachedChannel.current}::${generationRef.current}`
          : '',
        rootId: NATIVE_ROOT_ID,
        scrollViewId: attachedScrollViewID.current ?? '',
        composerId: 'scroll-stability-composer',
      }),
    []
  );

  const snapshot = useCallback(
    async (
      nativeSampledRulerContract?: NativeSampledRulerContract
    ): Promise<ScrollSnapshot> => {
      const started = performance.now();
      const ref = list.current;
      const state = ref?.getState();
      const target = semanticTarget.current;
      const targetMapKey = target
        ? `${target.scope}\0${target.key}`
        : undefined;
      const beforeCommit = targetMapKey
        ? renderCommits.current.get(targetMapKey)
        : undefined;
      const beforeKeys = state?.data.map((item) => item.post?.id ?? item.id);
      const registeredRowCount = rows.current.size;
      // Native keyboard insets can put an actually visible row outside the list's
      // estimated range. Measure every mounted wrapper; virtualization bounds this
      // set, and the coherence budget still rejects slow acquisitions.
      const measuredViews = [...rows.current];
      const scopeBefore = `${attachedChannel.current ?? ''}::${generationRef.current}`;
      const composerBefore = composer.current;
      const requiredBefore = [...requiredRows.current];
      let nativeAdapted:
        | ReturnType<typeof adaptNativeScrollGeometry>
        | undefined;
      if (Platform.OS === 'ios') {
        const request: NativeGeometryRequest = {
          requestId: `native-${++nativeCaptureSequence.current}`,
          rootId: NATIVE_ROOT_ID,
          scrollViewId: attachedScrollViewID.current ?? '',
          composerId: 'scroll-stability-composer',
          rows: measuredViews.map(([key]) => ({
            key,
            id: `scroll-row-${key}`,
          })),
        };
        let raw: unknown;
        try {
          const module = requireOptionalNativeModule<{
            captureScrollGeometry?: (
              requestId: string,
              rootId: string,
              scrollViewId: string,
              rowIds: string[],
              composerId: string
            ) => Promise<unknown>;
          }>('TlonScrollEdgeEffect');
          if (module?.captureScrollGeometry) {
            raw = await new Promise<unknown>((resolve, reject) => {
              const timer = setTimeout(
                () =>
                  resolve({
                    status: 'unavailable',
                    issues: ['native-capture-timeout'],
                  }),
                250
              );
              module.captureScrollGeometry!(
                request.requestId,
                request.rootId,
                request.scrollViewId,
                request.rows.map((row) => row.id),
                request.composerId
              ).then(
                (value) => {
                  clearTimeout(timer);
                  resolve(value);
                },
                (error) => {
                  clearTimeout(timer);
                  reject(error);
                }
              );
            });
          } else {
            raw = {
              status: 'unavailable',
              issues: ['native-module-unavailable'],
            };
          }
        } catch (error) {
          raw = {
            status: 'unavailable',
            issues: ['native-capture-error'],
            error: String(error),
          };
        }
        nativeAdapted = adaptNativeScrollGeometry(raw, request, {
          requestedAt: started,
          receivedAt: performance.now(),
          requiredKeys: requiredBefore,
          populated: (state?.data.length ?? 0) > 0,
          ...(nativeSampledRulerContract
            ? {
                ruler: {
                  version: nativeSampledRulerContract.version,
                  scope: nativeSampledRulerContract.scope,
                },
              }
            : {}),
        });
        if (
          nativeSampledRulerContract &&
          (scopeBefore !== nativeSampledRulerContract.scope ||
            request.rootId !== nativeSampledRulerContract.rootId ||
            request.scrollViewId !== nativeSampledRulerContract.scrollViewId ||
            request.composerId !== nativeSampledRulerContract.composerId)
        ) {
          nativeAdapted.issues.push(
            'native-sampled-ruler-owner-contract-changed'
          );
          nativeAdapted.snapshot.acquisition!.nativeGeometry!.issues.push(
            'native-sampled-ruler-owner-contract-changed'
          );
          nativeAdapted.snapshot.measurement!.valid = false;
        }
      }
      // Legacy Android/web fixture diagnostics remain explicitly mixed-source.
      const [viewport, input, measured] = nativeAdapted
        ? ([null, null, []] as const)
        : await Promise.all([
            measure(
              ref?.getNativeScrollRef() as unknown as Measurable | undefined
            ),
            measure(composer.current),
            Promise.all(
              measuredViews.map(async ([key, view]) => {
                const frame = await measure(view);
                return frame && frame.height > 0 ? { key, ...frame } : null;
              })
            ),
          ]);
      const viewportTop = viewport?.y ?? 0;
      const viewportHeight = viewport?.height ?? state?.scrollLength ?? 0;
      const viewportBottom = Math.min(
        viewportTop + viewportHeight,
        input?.y ?? Infinity
      );
      const native = nativeScroll.current;
      const min = -(native?.contentInset?.top ?? 0);
      const max = native
        ? Math.max(
            min,
            native.contentSize.height -
              native.layoutMeasurement.height +
              (native.contentInset?.bottom ?? 0)
          )
        : undefined;
      const sampledAt = performance.now();
      const afterCommit = targetMapKey
        ? renderCommits.current.get(targetMapKey)
        : undefined;
      const afterKeys = ref
        ?.getState()
        .data.map((item) => item.post?.id ?? item.id);
      const semanticStable =
        !target ||
        (!!beforeCommit &&
          !!afterCommit &&
          JSON.stringify(beforeCommit.state) ===
            JSON.stringify(afterCommit.state) &&
          JSON.stringify(beforeKeys) === JSON.stringify(afterKeys) &&
          (afterCommit.state.presence === 'present'
            ? afterKeys?.includes(target.key) === true
            : afterKeys?.includes(target.key) === false) &&
          semanticTarget.current === target &&
          target.scope ===
            `${attachedChannel.current ?? ''}::${generationRef.current}`);
      const result: ScrollSnapshot = nativeAdapted?.snapshot ?? {
        time: sampledAt,
        acquisition: {
          registeredRowCount,
          selectedRowCount: measuredViews.length,
          measuredRowCount: measured.filter((frame) => frame !== null).length,
          visibleMeasuredRowCount: measured.filter(
            (frame) =>
              frame &&
              frame.y < viewportBottom &&
              frame.y + frame.height > viewportTop
          ).length,
          nativeMetricsReceivedAt: nativeMetricsReceivedAt.current,
          nativeMetricsAgeMs:
            nativeMetricsReceivedAt.current === null
              ? null
              : sampledAt - nativeMetricsReceivedAt.current,
        },
        measurement: {
          valid:
            !!viewport &&
            !!input &&
            !!state &&
            !!native &&
            semanticStable &&
            (state.data.length === 0 ||
              measured.some((frame) => frame !== null)) &&
            [...requiredRows.current].every((key) =>
              measured.some((frame) => frame?.key === key)
            ) &&
            list.current === ref &&
            measuredViews.every(([key, view], index) => {
              const frame = measured[index];
              const visible =
                frame &&
                frame.y < viewportBottom &&
                frame.y + frame.height > viewportTop;
              // A clipped offscreen native child may return zero/null geometry.
              // It is not required evidence. Reading witnesses remain mandatory.
              return (
                (!requiredRows.current.has(key) && !visible) ||
                (frame !== null && rows.current.get(key) === view)
              );
            }),
          durationMs: performance.now() - started,
        },
        ...(max !== undefined ? { scrollBounds: { min, max } } : {}),
        scroll: native?.contentOffset.y ?? state?.scroll ?? 0,
        contentLength: state?.contentLength ?? 0,
        viewportHeight,
        viewportTop,
        viewportBottom,
        keyboardHeight: Keyboard.metrics()?.height ?? 0,
        nearEnd: state?.isNearEnd ?? false,
        rows: measured.filter(
          (row): row is NonNullable<typeof row> => row !== null
        ),
      };
      if (nativeAdapted) {
        const registryStable = measuredViews.every(
          ([key, view]) =>
            !requiredBefore.includes(key) || rows.current.get(key) === view
        );
        const membershipStable =
          JSON.stringify(beforeKeys) === JSON.stringify(afterKeys);
        const scopeStable =
          scopeBefore ===
          `${attachedChannel.current ?? ''}::${generationRef.current}`;
        const coherent =
          !!ref &&
          list.current === ref &&
          composer.current === composerBefore &&
          registryStable &&
          membershipStable &&
          scopeStable &&
          semanticStable;
        // Record why a bracket failed without changing the existing predicate.
        // Membership arrays and commit states are copied so a later mutation
        // cannot rewrite the diagnostic observation exported with this sample.
        result.acquisition!.jsCoherence = {
          listPresent: !!ref,
          listIdentityStable: list.current === ref,
          composerIdentityStable: composer.current === composerBefore,
          requiredRowsStable: registryStable,
          membershipStable,
          scopeStable,
          semanticStable,
          coherent,
          before: {
            scope: scopeBefore,
            keys: beforeKeys ? [...beforeKeys] : null,
            semanticCommit: beforeCommit
              ? JSON.parse(JSON.stringify(beforeCommit.state))
              : null,
          },
          after: {
            scope: `${attachedChannel.current ?? ''}::${generationRef.current}`,
            keys: afterKeys ? [...afterKeys] : null,
            semanticCommit: afterCommit
              ? JSON.parse(JSON.stringify(afterCommit.state))
              : null,
          },
          changedRequiredRows: measuredViews
            .filter(
              ([key, view]) =>
                requiredBefore.includes(key) && rows.current.get(key) !== view
            )
            .map(([key]) => key),
          semanticTarget: target ? { ...target } : null,
        };
        if (!coherent) {
          nativeAdapted.issues.push('native-js-ownership-changed');
          result.acquisition!.nativeGeometry!.issues.push(
            'native-js-ownership-changed'
          );
          result.measurement!.valid = false;
        }
        // This includes JS validation work as well as the explicit bridge bracket.
        result.measurement!.durationMs = performance.now() - started;
      }
      if (target)
        semanticSnapshots.current.set(result, {
          commit: afterCommit,
          committedKeys: afterKeys ?? [],
          valid: semanticStable && result.measurement?.valid === true,
          durationMs: performance.now() - started,
        });
      return result;
    },
    []
  );

  const capture = useCallback(
    async (
      scenario: string,
      assertion: Trace['assertion'],
      action?: (
        entryMarkers?: NativeEntryActionMarkers
      ) => void | Promise<void>,
      duration = 1800,
      targetKey?: string,
      loadedImageKey?: string,
      imageLoadGate?: ImageLoadGate,
      preparedMutation?: PreparedRowMutation
    ) => {
      if (sampling.current || preparingCapture.current)
        throw new Error('A trace is already running');
      const nativeCorrectionOwner = correctionsEnabled.current
        ? correctionObservation.current
        : null;
      const targetCommand =
        scenario === nativeCenterCommand.scenario
          ? nativeCenterCommand
          : scenario === nativeOffscreenCommand.scenario
            ? nativeOffscreenCommand
            : undefined;
      // Fix semantic scope and native tags before baseline acquisition/action.
      const nativeSampledRulerContract = declareSampledRuler(scenario);
      const initialWindowHeight = Dimensions.get('window').height;
      const nativeLatestVisibilityInputs: Trace['nativeLatestVisibilityInputs'] =
        nativeSampledRulerContract
          ? {
              source: 'React Native Dimensions.get(window).height',
              before: {
                windowHeight: initialWindowHeight,
                atBottomThreshold: 1,
              },
              after: {
                windowHeight: initialWindowHeight,
                atBottomThreshold: 1,
              },
              changes: [],
            }
          : undefined;
      const windowSubscription = nativeLatestVisibilityInputs
        ? Dimensions.addEventListener('change', ({ window }) => {
            nativeLatestVisibilityInputs.changes.push({
              time: performance.now(),
              windowHeight: window.height,
            });
          })
        : undefined;
      preparingCapture.current = true;
      semanticTarget.current = preparedMutation
        ? {
            key: preparedMutation.key,
            scope: `${attachedChannel.current ?? ''}::${generationRef.current}`,
          }
        : null;
      if (preparedMutation) requiredRows.current.add(preparedMutation.key);
      setPanel(false);
      setStatus(`Preparing ${scenario}`);
      let baseline: ScrollSnapshot;
      try {
        await pause(100);
        baseline = await snapshot(nativeSampledRulerContract);
      } catch (error) {
        windowSubscription?.remove();
        preparingCapture.current = false;
        semanticTarget.current = null;
        requiredRows.current.clear();
        throw error;
      }
      const anchor = chooseReadingAnchor({
        ...baseline,
        rows: baseline.rows.filter(
          (row) =>
            row.key !== loadedImageKey && row.key !== preparedMutation?.key
        ),
      });
      const originalPosts = postsRef.current;
      requiredRows.current = new Set([
        ...(assertion === 'hold' && anchor ? [anchor.key] : []),
        ...(loadedImageKey ? [loadedImageKey] : []),
        ...(preparedMutation ? [preparedMutation.key] : []),
      ]);
      const baselineComposerHeight = composerHeight.current;
      const eventStart = events.current.length;
      sampling.current = true;
      preparingCapture.current = false;
      setStatus(`Recording ${scenario}`);
      const samples: ScrollSnapshot[] = [baseline];
      const startedAt = performance.now();
      const deadline = startedAt + duration;
      const nativeCenterCommandContract:
        | NativeCenterCommandContract
        | undefined =
        scenario === nativeCenterCommand.scenario
          ? {
              version: 1,
              scope: nativeSampledRulerContract?.scope ?? '',
              startedAt,
            }
          : undefined;
      const nativeOffscreenCommandContract:
        | NativeOffscreenCommandContract
        | undefined =
        scenario === nativeOffscreenCommand.scenario
          ? {
              version: 1,
              scope: nativeSampledRulerContract?.scope ?? '',
              startedAt,
            }
          : undefined;
      const baselineRender = semanticSnapshots.current.get(baseline)?.commit;
      let mutationPlan: RowMutationContract | undefined;
      if (preparedMutation && baselineRender?.state.presence === 'present') {
        const requestId = `${runId.current}:${scenario}:mutation`;
        const declaredAt = performance.now();
        mutationPlan = {
          version: 1,
          scope: semanticTarget.current!.scope,
          key: preparedMutation.key,
          kind: preparedMutation.kind,
          declaredAt,
          baseline: {
            requestId: `${requestId}:baseline`,
            revision: 'baseline-render',
            state: baselineRender.state,
          },
          coverage: {
            startTime: baseline.time,
            endTime: deadline,
            maxGapMs: 125,
            maxMeasurementDurationMs: 32,
          },
          deferredUntil: baseline.time + 700,
          phases: [
            {
              id: 'mutation-ready',
              requestId,
              revision: 'expected-render',
              state: preparedMutation.expected,
              requestWindow: {
                startTime: baseline.time + 250,
                endTime: baseline.time + 450,
              },
              observationWindow: {
                startTime: baseline.time + 700,
                endTime: deadline,
              },
              effect:
                preparedMutation.kind === 'remove'
                  ? 'remove'
                  : preparedMutation.kind === 'reference'
                    ? 'commit'
                    : 'resize',
            },
          ],
        };
        event(
          'row-mutation-plan',
          { contract: rowMutationContractFingerprint(mutationPlan) },
          declaredAt
        );
      }
      let completedAt = startedAt;
      let actionError: unknown;
      let actionCompleted = false;
      const nativeRecordingModule =
        Platform.OS === 'ios'
          ? requireOptionalNativeModule<NativeRecordingModule>(
              'TlonScrollEdgeEffect'
            )
          : null;
      let nativeRecording: unknown;
      let nativeRecordingOwned = false;
      let nativeStartAcknowledgedAt = 0;
      let nativeEarliestStopAt = 0;
      let nativeRecordingTransfer: Trace['nativeRecordingTransfer'];
      const nativeRecordingContract: NativeRecordingContract | undefined =
        Platform.OS === 'ios'
          ? {
              recordingId: `${runId.current}:${scenario}:${++nativeCaptureSequence.current}`,
              scope: `${attachedChannel.current ?? ''}::${generationRef.current}`,
              request: {
                rootId: NATIVE_ROOT_ID,
                scrollViewId: attachedScrollViewID.current ?? '',
                composerId: 'scroll-stability-composer',
                rowPrefix: 'scroll-row-',
                durationMs: Math.min(15_000, duration + 1500),
                maximumFrames: 900,
              },
              requiredKeys: assertion === 'hold' && anchor ? [anchor.key] : [],
              populated: originalPosts.length > 0,
              visibility: scenario.startsWith('entry-')
                ? 'observe-entry-concealment'
                : 'require-visible',
              minimumDurationMs: Math.max(100, duration - 125),
              ...(scenario.startsWith('entry-')
                ? {
                    itinerary: {
                      version: 1,
                      owners: [
                        {
                          rootId: NATIVE_ROOT_ID,
                          scope: `${attachedChannel.current ?? ''}::${generationRef.current}`,
                          scrollViewId: attachedScrollViewID.current ?? '',
                        },
                        {
                          rootId: NATIVE_ROOT_ID,
                          scope: `${attachedChannel.current ?? ''}::${generationRef.current + 1}`,
                          scrollViewPrefix:
                            'tlon-conversation-scroll-edge-content-',
                        },
                      ],
                    },
                  }
                : {}),
            }
          : undefined;
      // Declare this independent native proof before the recorder or action starts.
      // The mixed JS/native mutation witness below keeps its existing contract.
      const nativeMutationContract: NativeMutationContract | undefined =
        nativeRecordingContract && mutationPlan && anchor
          ? {
              version: 1,
              recordingId: nativeRecordingContract.recordingId,
              requestId: mutationPlan.phases[0].requestId,
              requestMarker: `${mutationPlan.phases[0].requestId}:native-request`,
              declaredAt: performance.now(),
              scope: mutationPlan.scope,
              key: mutationPlan.key,
              kind: mutationPlan.kind,
              baseline: mutationPlan.baseline.state,
              expected: mutationPlan.phases[0].state,
              anchorKey: anchor.key,
              readyDeadlineMs: 400,
              quietTailMs: 1000,
              minimumDurationMs: 1800,
            }
          : undefined;
      if (nativeMutationContract)
        event(
          'native-mutation-plan',
          { contract: JSON.stringify(nativeMutationContract) },
          nativeMutationContract.declaredAt
        );
      const nativePostGestureProbe: Trace['nativePostGestureProbe'] =
        nativeRecordingContract &&
        /^armed-post-gesture-thinking-(end|away)$/.test(scenario)
          ? {
              contract: {
                version: 1,
                recordingId: nativeRecordingContract.recordingId,
                scope: nativeRecordingContract.scope,
                outcome: scenario.endsWith('-end') ? 'end' : 'away',
                declaredAt: performance.now(),
                probeId: `${nativeRecordingContract.recordingId}:post-gesture`,
                quietTailMs: 1000,
                tolerancePt: 1,
              },
              markerTransfers: [],
            }
          : undefined;
      if (nativePostGestureProbe)
        event(
          'native-post-gesture-plan',
          { contract: JSON.stringify(nativePostGestureProbe.contract) },
          nativePostGestureProbe.contract.declaredAt
        );
      let nativeMutationMarkerTransfer: Trace['nativeMutationMarkerTransfer'];
      const entryMode = scenario.slice('entry-'.length);
      const nativeEntryContract: NativeEntryContract | undefined =
        nativeRecordingContract?.itinerary &&
        (entryMode === 'latest' ||
          entryMode === 'selected' ||
          entryMode === 'delayed')
          ? {
              version: 1,
              ruler: 'indexed-cell-and-surfaces-v1',
              recordingId: nativeRecordingContract.recordingId,
              requestId: `${nativeRecordingContract.recordingId}:entry`,
              mode: entryMode,
              destinationScope:
                nativeRecordingContract.itinerary.owners[1].scope,
              expectedPosts: Array.from({ length: 90 }, (_, index) => {
                const post = makePost(index + 30);
                return { key: post.id, signature: mutationSignature(post) };
              }),
              resetMarker: `${nativeRecordingContract.recordingId}:entry:reset`,
              dataMarker: `${nativeRecordingContract.recordingId}:entry:data`,
              readyDeadlineMs: 2800,
              quietTailMs: 1000,
            }
          : undefined;
      const nativeEntryMarkerTransfers: NonNullable<
        Trace['nativeEntryMarkerTransfers']
      > = [];
      const markNativeEntry = async (kind: 'reset' | 'data') => {
        if (!nativeEntryContract || !nativeRecordingOwned) return;
        const name = nativeEntryContract[`${kind}Marker`];
        const requestedAt = performance.now();
        const acknowledgement =
          await nativeRecordingModule!.markScrollGeometryRecording(
            nativeEntryContract.recordingId,
            name
          );
        const receivedAt = performance.now();
        nativeEntryMarkerTransfers.push({
          name,
          requestedAt,
          receivedAt,
          clock: 'performance.now milliseconds',
        });
        if (
          !acknowledgement ||
          typeof acknowledgement !== 'object' ||
          !('status' in acknowledgement) ||
          acknowledgement.status !== 'ok'
        )
          throw new Error(`Native entry marker was not recorded: ${kind}`);
        if (kind === 'reset') {
          // This predeclared extension preserves the old JavaScript window.
          // Replay checks the actual native marker/deadline/tail in its own clock.
          nativeEarliestStopAt = Math.max(
            nativeEarliestStopAt,
            receivedAt +
              nativeEntryContract.readyDeadlineMs +
              nativeEntryContract.quietTailMs
          );
        }
      };
      try {
        if (nativeRecordingContract) {
          const { request, recordingId, itinerary } = nativeRecordingContract;
          const start = itinerary
            ? nativeRecordingModule?.startScrollGeometryItineraryRecording?.(
                recordingId,
                JSON.stringify(itinerary),
                request.rowPrefix,
                request.composerId,
                request.durationMs,
                request.maximumFrames
              )
            : nativeRecordingModule?.startScrollGeometryRecording?.(
                recordingId,
                request.rootId,
                request.scrollViewId,
                request.rowPrefix,
                request.composerId,
                request.durationMs,
                request.maximumFrames
              );
          if (start) {
            const started = await start;
            nativeRecordingOwned =
              started.status === 'ok' && started.recordingId === recordingId;
            if (nativeRecordingOwned) {
              nativeStartAcknowledgedAt = performance.now();
              nativeEarliestStopAt = nativeStartAcknowledgedAt + duration;
            }
            if (!nativeRecordingOwned) nativeRecording = started;
          } else
            nativeRecording = {
              status: 'unavailable',
              issues: ['native-recording-module-unavailable'],
            };
        }
        event('scenario-start', { scenario, assertion });
        const actionDone = Promise.resolve()
          .then(async () => {
            const armedInput =
              /^(armed-thinking-|armed-image-load-|armed-post-gesture-thinking-)/.test(
                scenario
              );
            if (armedInput && Platform.OS === 'ios' && !nativeRecordingOwned)
              throw new Error(
                'Armed input requires its native recording acknowledgement'
              );
            if (nativeRecordingOwned) {
              const marker =
                await nativeRecordingModule!.markScrollGeometryRecording(
                  nativeRecordingContract!.recordingId,
                  'action-start'
                );
              if (
                armedInput &&
                (!marker ||
                  typeof marker !== 'object' ||
                  !('status' in marker) ||
                  marker.status !== 'ok' ||
                  !('recordingId' in marker) ||
                  marker.recordingId !== nativeRecordingContract!.recordingId ||
                  !('marker' in marker) ||
                  !marker.marker ||
                  typeof marker.marker !== 'object' ||
                  !('name' in marker.marker) ||
                  marker.marker.name !== 'action-start')
              )
                throw new Error(
                  'Armed input requires its native action marker acknowledgement'
                );
            }
            if (nativePostGestureProbe) {
              const probe = nativePostGestureProbe;
              const listOwner = list.current;
              const commandOwner = commands.current;
              const scope = `${attachedChannel.current ?? ''}::${generationRef.current}`;
              const armedAt = performance.now();
              probe.armedAt = armedAt;
              event(
                'native-post-gesture-armed',
                { probeId: probe.contract.probeId },
                armedAt
              );
              setStatus(`Armed ${scenario}`);
              let completion: FixtureEvent | undefined;
              await waitUntil(
                () => {
                  const current = events.current.filter(
                    (e) => e.time >= armedAt
                  );
                  const begins = current.filter((e) => e.name === 'drag-begin');
                  if (begins.length !== 1) return false;
                  const after = current.filter((e) => e.time >= begins[0].time);
                  const dragEnd = after.find((e) => e.name === 'drag-end');
                  if (!dragEnd) return false;
                  const momentum = after.find(
                    (e) => e.name === 'momentum-begin'
                  );
                  completion = momentum
                    ? after.find(
                        (e) =>
                          e.name === 'momentum-end' && e.time >= momentum.time
                      )
                    : dragEnd;
                  return !!completion;
                },
                'No matching actual gesture completion for the declared native tail.',
                2800
              );
              probe.completion = completion;
              const isCurrentIntent = commandOwner?.captureScrollIntent?.();
              if (!isCurrentIntent)
                throw new Error(
                  'No current command owner for the native tail.'
                );
              const settled = await snapshot(nativeSampledRulerContract);
              probe.baseline = settled;
              const g = settled.acquisition?.nativeGeometry?.capture as
                | import('./scrollNativeGeometry').NativeGeometryCapture
                | undefined;
              const newer = events.current.some(
                (e) =>
                  e.time > completion!.time &&
                  /^(drag-begin|momentum-begin|reset|position|media-open|reference-open|center-command-request|offscreen-command-request|local-send|keyboard|composer-input)/.test(
                    e.name
                  )
              );
              if (
                list.current !== listOwner ||
                commands.current !== commandOwner ||
                scope !==
                  `${attachedChannel.current ?? ''}::${generationRef.current}` ||
                !isCurrentIntent() ||
                newer ||
                !settled.measurement?.valid ||
                settled.measurement.durationMs > 32 ||
                !g?.scroll ||
                g.scroll.tracking ||
                g.scroll.dragging ||
                g.scroll.decelerating
              )
                throw new Error(
                  'The post-gesture baseline is not the same current stationary native owner.'
                );
              const distance = settled.scrollBounds
                ? settled.scrollBounds.max - settled.scroll
                : NaN;
              if (
                !Number.isFinite(distance) ||
                (probe.contract.outcome === 'end'
                  ? Math.abs(distance) > 1
                  : distance <= 1)
              )
                throw new Error(
                  'Actual gesture endpoint differs from the declared probe.'
                );
              if (probe.contract.outcome === 'away') {
                const anchor = chooseReadingAnchor(settled);
                if (!anchor)
                  throw new Error('No exposed post-gesture reading anchor.');
                probe.anchorKey = anchor.key;
                requiredRows.current.add(anchor.key);
              }
              // The accepted recording window is fixed; no late-input extension.
              if (performance.now() > deadline - 1100)
                throw new Error(
                  'Post-gesture probe cannot retain its quiet tail.'
                );
              const mark = async (phase: 'start' | 'hidden') => {
                const name = `${probe.contract.probeId}:${phase}`;
                const requestedAt = performance.now();
                const ack =
                  await nativeRecordingModule!.markScrollGeometryRecording(
                    probe.contract.recordingId,
                    name
                  );
                const receivedAt = performance.now();
                probe.markerTransfers.push({
                  name,
                  requestedAt,
                  receivedAt,
                  clock: 'performance.now milliseconds',
                });
                if (
                  !ack ||
                  typeof ack !== 'object' ||
                  !('status' in ack) ||
                  ack.status !== 'ok' ||
                  !('recordingId' in ack) ||
                  ack.recordingId !== probe.contract.recordingId ||
                  !('marker' in ack) ||
                  !ack.marker ||
                  typeof ack.marker !== 'object' ||
                  !('name' in ack.marker) ||
                  ack.marker.name !== name
                )
                  throw new Error(
                    'Native post-gesture marker did not acknowledge its exact owner.'
                  );
              };
              await mark('start');
              if (!isCurrentIntent())
                throw new Error(
                  'A newer intent retired the pending native tail.'
                );
              await action?.();
              await mark('hidden');
              return;
            }
            if (!preparedMutation)
              return action?.(
                nativeEntryContract
                  ? {
                      reset: () => markNativeEntry('reset'),
                      data: () => markNativeEntry('data'),
                    }
                  : undefined
              );
            if (!mutationPlan)
              throw new Error('No committed semantic baseline was acquired');
            await pause(Math.max(0, baseline.time + 300 - performance.now()));
            const phase = mutationPlan.phases[0];
            if (nativeMutationContract && nativeRecordingOwned) {
              const requestedAt = performance.now();
              const acknowledgement =
                await nativeRecordingModule!.markScrollGeometryRecording(
                  nativeMutationContract.recordingId,
                  nativeMutationContract.requestMarker
                );
              const receivedAt = performance.now();
              nativeMutationMarkerTransfer = {
                name: nativeMutationContract.requestMarker,
                requestedAt,
                receivedAt,
                clock: 'performance.now milliseconds',
              };
              if (
                !acknowledgement ||
                typeof acknowledgement !== 'object' ||
                !('status' in acknowledgement) ||
                acknowledgement.status !== 'ok'
              )
                throw new Error(
                  'Native mutation request marker was not recorded'
                );
              // Preserve the declared native tail without delaying the mutation
              // behind the independent JS geometry observer.
              nativeEarliestStopAt = Math.max(
                nativeEarliestStopAt,
                receivedAt +
                  nativeMutationContract.readyDeadlineMs +
                  nativeMutationContract.quietTailMs
              );
            }
            event('row-change', preparedMutation.selection);
            event('row-mutation-request', {
              key: preparedMutation.key,
              kind: preparedMutation.kind,
              scope: mutationPlan.scope,
              phaseId: phase.id,
              requestId: phase.requestId,
              revision: phase.revision,
            });
            if (preparedMutation.kind === 'remove')
              requiredRows.current.delete(preparedMutation.key);
            preparedMutation.apply();
          })
          .then(() => {
            completedAt = performance.now();
            actionCompleted = true;
          })
          .catch((error) => {
            actionError = error;
          });
        while (!disposed.current && performance.now() < deadline) {
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve())
          );
          samples.push(await snapshot(nativeSampledRulerContract));
        }
        await Promise.race([actionDone, pause(1000)]);
        samples.push(await snapshot(nativeSampledRulerContract));
        if (nativeRecordingOwned) {
          // Preserve the native window even if starting its bridge request
          // consumed part of the older JavaScript collector's fixed window.
          await pause(Math.max(0, nativeEarliestStopAt - performance.now()));
          const requestedAt = performance.now();
          nativeRecording =
            await nativeRecordingModule!.stopScrollGeometryRecording(
              nativeRecordingContract!.recordingId
            );
          nativeRecordingOwned = false;
          nativeRecordingTransfer = {
            startAcknowledgedAt: nativeStartAcknowledgedAt,
            earliestStopAt: nativeEarliestStopAt,
            requestedAt,
            receivedAt: performance.now(),
            clock: 'performance.now milliseconds',
          };
        }
        if (nativeLatestVisibilityInputs)
          nativeLatestVisibilityInputs.after.windowHeight =
            Dimensions.get('window').height;
        const nativeAcquisition = nativeRecordingContract
          ? assessNativeRecording(
              nativeRecording,
              nativeRecordingContract,
              adaptBufferedNativeScrollGeometry
            )
          : undefined;
        const capturedEvents =
          mutationPlan && baselineRender
            ? [baselineRender.event, ...events.current.slice(eventStart)]
                .map((observed) =>
                  annotateMutationEvent(observed, mutationPlan!)
                )
                .sort((a, b) => a.time - b.time)
            : events.current.slice(eventStart);
        const changedRows = capturedEvents.some(
          (e) => e.name === 'row-commit' || e.name === 'row-layout'
        );
        const changedData = postsRef.current !== originalPosts;
        const committedPosts = list.current?.getState().data;
        const committedDataKeys = committedPosts?.map(
          (item) => item.post?.id ?? item.id
        );
        const mutationCase =
          /^(near|history)-(grow|shrink|reference|media|remove|reaction|reply|cache)$/.test(
            scenario
          );
        const mutationEvidence: RowMutationEvidence | undefined = mutationCase
          ? {
              events: capturedEvents,
              samples,
              committedKeys: committedDataKeys,
              contract: mutationPlan,
              semanticSamples: mutationPlan
                ? samples.flatMap((sample): RowMutationSemanticSample[] => {
                    const captured = semanticSnapshots.current.get(sample);
                    const observed = captured?.commit;
                    if (!captured || !observed) return [];
                    return [
                      {
                        time: sample.time,
                        key: String(observed.event.values?.key ?? ''),
                        scope: String(observed.event.values?.scope ?? ''),
                        commitId: String(observed.event.values?.commitId ?? ''),
                        ...capturedMutationRevision(
                          mutationPlan!,
                          observed.state
                        ),
                        state: observed.state,
                        committedKeys: captured.committedKeys,
                        measurement: {
                          valid: captured.valid,
                          durationMs: captured.durationMs,
                        },
                      },
                    ];
                  })
                : undefined,
            }
          : undefined;
        const mutationWitness = mutationEvidence
          ? assessRowMutationWitness(mutationEvidence)
          : undefined;
        const dataCommitted =
          committedPosts?.length === postsRef.current.length &&
          committedPosts.every(
            (item, index) =>
              (item.post?.id ?? item.id) === postsRef.current[index].id
          );
        const interaction = capturedEvents.some((e) =>
          /^(keyboard|drag|momentum|local-send|cache-change)/.test(e.name)
        );
        const geometryChanged = samples.some(
          (sample) =>
            Math.abs(sample.scroll - baseline.scroll) > 1 ||
            sample.keyboardHeight !== baseline.keyboardHeight
        );
        const keyboardCase =
          /^(keyboard-(history|end)|dismiss-history|armed-(thinking|image-load)-keyboard-(history|end))$/.test(
            scenario
          );
        const composerCase =
          /^(armed-image-load-)?composer-(history|end)$/.test(scenario);
        const gestureCase = assertion === 'gesture';
        const imageInteraction: ImageLoadInteraction | undefined =
          scenario.startsWith('armed-image-load-')
            ? keyboardCase
              ? 'keyboard'
              : composerCase
                ? 'composer'
                : 'gesture'
            : undefined;
        const followingThroughout =
          assertion === 'bottom' &&
          !scenario.startsWith('entry-') &&
          scenario !== 'empty-first-post' &&
          !keyboardCase &&
          !composerCase;
        const thinkingCase =
          scenario.startsWith('thinking-') ||
          scenario.startsWith('armed-thinking-');
        const thinkingRequests = capturedEvents.filter(
          (e) => e.name === 'thinking-request'
        );
        const thinkingCommits = capturedEvents.filter(
          (e) => e.name === 'thinking-commit'
        );
        const thinkingLayouts = capturedEvents.filter(
          (e) => e.name === 'thinking-layout'
        );
        const thinkingWitness =
          thinkingRequests.length > 0 &&
          thinkingRequests.every(
            (request) =>
              thinkingCommits.some(
                (commit) =>
                  commit.time >= request.time &&
                  commit.values?.visible === request.values?.visible &&
                  (!request.values?.visible ||
                    commit.values?.label === request.values?.label)
              ) &&
              (request.values?.layoutChange !== true ||
                thinkingLayouts.some(
                  (layout) =>
                    layout.time >= request.time &&
                    layout.values?.height === (request.values?.visible ? 52 : 0)
                ))
          );
        const keyboardCompletions = capturedEvents.filter((e) =>
          /^keyboardDid(Show|Hide)$/.test(e.name)
        );
        const composerLayouts = capturedEvents.filter(
          (e) =>
            e.name === 'composer-layout' &&
            typeof e.values?.height === 'number' &&
            baselineComposerHeight !== undefined &&
            Math.abs(e.values.height - baselineComposerHeight) > 1
        );
        const gestureCompletions = capturedEvents.filter(
          (e) => e.name === 'drag-end' || e.name === 'momentum-end'
        );
        const loadedImageBaseline = baseline.rows.find(
          (row) => row.key === loadedImageKey
        );
        const loadedImageLayouts = capturedEvents.filter(
          (e) =>
            e.name === 'row-layout' &&
            e.values?.key === loadedImageKey &&
            typeof e.values?.height === 'number' &&
            loadedImageBaseline &&
            Math.abs(e.values.height - loadedImageBaseline.height) > 1
        );
        const imageLoadEvidence:
          | Parameters<typeof assessImageLoadWitness>[0]
          | undefined = loadedImageKey
          ? {
              events: capturedEvents,
              gate: imageLoadGate,
              recordingStartTime: baseline.time,
              baselineHeight: loadedImageBaseline?.height,
              baselineComposerHeight,
              propsUnchanged: !changedData,
              measurements: samples.flatMap((sample) => {
                const row = sample.rows.find(
                  (row) => row.key === loadedImageKey
                );
                return row &&
                  sample.measurement?.valid &&
                  Number.isFinite(sample.measurement.durationMs) &&
                  sample.measurement.durationMs <= 32
                  ? [{ time: sample.time, height: row.height }]
                  : [];
              }),
              interaction: imageInteraction,
            }
          : undefined;
        const imageLoadWitness = imageLoadEvidence
          ? assessImageLoadWitness(imageLoadEvidence)
          : undefined;
        const causalCompletions = [
          ...loadedImageLayouts,
          ...(keyboardCase ? keyboardCompletions : []),
          ...(composerCase ? composerLayouts : []),
          ...(gestureCase ? gestureCompletions : []),
        ];
        if (causalCompletions.length)
          completedAt = Math.max(completedAt, causalCompletions.at(-1)!.time);
        const interactionWitness = targetCommand
          ? capturedEvents.some(
              (e) =>
                e.name ===
                (nativeOffscreenCommandContract
                  ? 'offscreen-command-request'
                  : 'center-command-request')
            )
          : keyboardCase
            ? keyboardCompletions.length > 0 &&
              samples.some((s) => s.keyboardHeight !== baseline.keyboardHeight)
            : composerCase
              ? capturedEvents.some((e) => e.name === 'composer-input') &&
                composerLayouts.length > 0
              : gestureCase
                ? capturedEvents.some((e) => e.name === 'drag-begin') &&
                  gestureCompletions.length > 0 &&
                  geometryChanged
                : (changedData && dataCommitted) ||
                  (interaction && (changedRows || geometryChanged)) ||
                  (assertion === 'target' && geometryChanged);
        if (
          mutationWitness &&
          mutationWitness.verdict !== 'INCOMPLETE' &&
          mutationWitness.effectTime !== undefined
        )
          completedAt = Math.max(completedAt, mutationWitness.effectTime);
        const specificWitness = mutationCase
          ? mutationWitness?.verdict === 'PASS' ||
            mutationWitness?.verdict === 'FAIL'
          : loadedImageKey
            ? imageLoadWitness?.observed === true &&
              (!imageInteraction || interactionWitness)
            : interactionWitness;
        const observed =
          actionCompleted &&
          !actionError &&
          (thinkingCase
            ? thinkingWitness &&
              ((!keyboardCase && !gestureCase) || specificWitness)
            : specificWitness);
        const assessment = anchor
          ? assessAnchorTrace(samples, anchor.key, anchor.y)
          : null;
        const settleStartTime = targetCommand
          ? startedAt + targetCommand.landingDeadlineMs
          : deadline - 300;
        const expectations: ScrollTraceExpectations | null =
          assertion === 'observe'
            ? null
            : {
                action: { name: scenario, startedAt, completedAt, observed },
                coverage: {
                  startTime: baseline.time,
                  endTime: deadline,
                },
                requireMeasurementMetadata: true,
                requireVisibleContent:
                  !scenario.startsWith('entry-') &&
                  scenario !== 'empty-first-post' &&
                  scenario !== 'thinking-empty-show-hide',
                ...(assertion === 'hold' && anchor
                  ? { anchor: { key: anchor.key, baselineY: anchor.y } }
                  : {}),
                ...(assertion === 'bottom' &&
                scenario !== 'thinking-empty-show-hide'
                  ? {
                      bottom: {
                        // ENTRY and viewport animations have an explicit final
                        // landing contract. Already-following content mutations
                        // must remain at the end throughout the sampled trace.
                        ...(changedData ||
                        scenario.startsWith('entry-') ||
                        scenario === 'empty-first-post' ||
                        keyboardCase ||
                        composerCase
                          ? { startTime: settleStartTime }
                          : {}),
                        tailKey: postsRef.current.at(-1)?.id,
                      },
                    }
                  : {}),
                ...(assertion === 'target' && targetKey
                  ? {
                      landing: {
                        key: targetKey,
                        alignment: 'center' as const,
                        settleStartTime,
                      },
                    }
                  : {}),
              };
        const result = expectations
          ? assessScrollTrace(samples, expectations)
          : null;
        const incomplete = (code: string, message: string) => {
          if (!result) return;
          if (result.verdict !== 'FAIL') result.verdict = 'INCOMPLETE';
          result.passed = false;
          result.issues.push({ code, kind: 'incomplete', message });
        };
        if (actionError) incomplete('action-error', String(actionError));
        if (loadedImageKey && !imageLoadWitness?.observed)
          incomplete(
            'image-load-not-witnessed',
            imageLoadWitness?.reasons.join(', ') ??
              'The image load witness is missing.'
          );
        if (!actionCompleted)
          incomplete(
            'action-not-completed',
            'The action did not complete within the capture deadline.'
          );
        if (thinkingCase && !thinkingWitness)
          incomplete(
            'thinking-not-witnessed',
            'Expected production indicator commits and52/0 native layouts were not observed.'
          );
        if (followingThroughout && changedData && result) {
          // The expected final tail does not exist on the baseline. Check end
          // offsets throughout, then the new tail identity during settlement.
          for (const [index, sample] of samples.entries()) {
            if (
              !sample.measurement?.valid ||
              !Number.isFinite(sample.measurement.durationMs) ||
              sample.measurement.durationMs > 32 ||
              !sample.scrollBounds
            ) {
              incomplete(
                'following-offset-unmeasured',
                'End-following geometry was not coherently measured.'
              );
            } else if (Math.abs(sample.scroll - sample.scrollBounds.max) > 1) {
              result.verdict = 'FAIL';
              result.passed = false;
              result.issues.push({
                code: 'bottom-distance',
                kind: 'failure',
                sampleIndex: index,
                message:
                  'The list left its legal end during the content mutation.',
              });
            }
          }
        }
        if (scenario === 'thinking-empty-show-hide' && result) {
          if (
            postsRef.current.length !== 0 ||
            samples.some((sample) => sample.rows.length > 0)
          ) {
            incomplete(
              'empty-scope-not-established',
              'The empty thinking case unexpectedly contains post rows.'
            );
          }
          for (const [index, sample] of samples.entries()) {
            if (!sample.measurement?.valid || !sample.scrollBounds) {
              incomplete(
                'empty-boundary-unmeasured',
                'The empty list needs measured legal end geometry.'
              );
            } else if (Math.abs(sample.scroll - sample.scrollBounds.max) > 1) {
              result.verdict = 'FAIL';
              result.passed = false;
              result.issues.push({
                code: 'empty-end-distance',
                kind: 'failure',
                sampleIndex: index,
                message:
                  'Thinking changed the empty list away from its legal end.',
              });
            }
          }
        }
        if (
          scenario.startsWith('armed-thinking-') &&
          !hasThinkingMotionOverlap(
            capturedEvents,
            keyboardCase ? 'keyboard' : 'gesture'
          )
        ) {
          incomplete(
            'thinking-motion-overlap-unobserved',
            'No actual indicator layout change overlapped one matched real keyboard/drag transition.'
          );
        }
        if (assertion === 'target' && !targetKey) {
          incomplete(
            'missing-target-identity',
            'No expected target identity was supplied.'
          );
        }
        if (gestureCase && result) {
          let witnessedPairs = 0;
          for (let index = 1; index < samples.length; index++) {
            const previous = samples[index - 1];
            const current = samples[index];
            if (!previous.measurement?.valid || !current.measurement?.valid)
              continue;
            const previousImage = previous.rows.find(
              (row) => row.key === loadedImageKey
            );
            const currentImage = current.rows.find(
              (row) => row.key === loadedImageKey
            );
            const imageHeightDelta =
              previousImage && currentImage
                ? currentImage.height - previousImage.height
                : undefined;
            const imageExplainsExtent =
              imageInteraction === 'gesture' &&
              imageHeightDelta !== undefined &&
              Math.abs(
                current.contentLength -
                  previous.contentLength -
                  imageHeightDelta
              ) <= 1;
            if (
              (Math.abs(current.contentLength - previous.contentLength) > 1 &&
                !imageExplainsExtent &&
                !(
                  thinkingCase &&
                  (Platform.OS === 'ios'
                    ? nativeThinkingGestureExtentIsMeasured(
                        previous,
                        current,
                        capturedEvents,
                        postsRef.current.map((post) => post.id)
                      )
                    : thinkingLayouts.some(
                        (e) => e.time >= previous.time && e.time <= current.time
                      ))
                )) ||
              changedData
            ) {
              incomplete(
                'gesture-layout-changed',
                'Gesture compensation requires an explicit contract when layout changes.'
              );
              continue;
            }
            const witness = previous.rows.find(
              (row) =>
                row.key !== loadedImageKey &&
                row.y < previous.viewportBottom &&
                row.y + row.height > previous.viewportTop &&
                current.rows.some(
                  (next) =>
                    next.key === row.key &&
                    next.y < current.viewportBottom &&
                    next.y + next.height > current.viewportTop
                )
            );
            const next = current.rows.find((row) => row.key === witness?.key);
            if (
              !witness ||
              !next ||
              Math.abs(next.height - witness.height) > 1
            ) {
              incomplete(
                'gesture-witness-missing',
                'No unchanged visible row spans consecutive gesture samples.'
              );
              continue;
            }
            const imageIndex = postsRef.current.findIndex(
              (post) => post.id === loadedImageKey
            );
            const witnessIndex = postsRef.current.findIndex(
              (post) => post.id === witness.key
            );
            if (
              imageInteraction === 'gesture' &&
              (imageHeightDelta === undefined ||
                imageIndex < 0 ||
                witnessIndex < 0)
            ) {
              incomplete(
                'image-gesture-displacement-unmeasured',
                'The image height delta and unchanged witness order must be measured across the gesture interval.'
              );
              continue;
            }
            witnessedPairs++;
            const residual =
              imageInteraction === 'gesture'
                ? imageGestureDisplacementErrorPt({
                    rowDelta: next.y - witness.y,
                    scrollDelta: current.scroll - previous.scroll,
                    viewportDelta: current.viewportTop - previous.viewportTop,
                    imageHeightDelta: imageHeightDelta!,
                    imageBeforeWitness: imageIndex < witnessIndex,
                  })
                : Math.abs(
                    next.y -
                      witness.y +
                      current.scroll -
                      previous.scroll -
                      (current.viewportTop - previous.viewportTop)
                  );
            if (residual === undefined) {
              incomplete(
                'image-gesture-invalid-geometry',
                'The row, image, viewport and scroll deltas must all be finite.'
              );
              continue;
            }
            if (residual > 1) {
              result.verdict = 'FAIL';
              result.passed = false;
              result.issues.push({
                code: 'gesture-displacement',
                kind: 'failure',
                sampleIndex: index,
                message: `Visible row displacement differs from native scroll displacement by ${residual} pt.`,
              });
            }
          }
          if (!witnessedPairs)
            incomplete(
              'gesture-unmeasured',
              'No coherent gesture interval was measured.'
            );
        }
        const mutationKey = capturedEvents.find(
          (e) => e.name === 'row-mutation-request'
        )?.values?.key;
        const baselinePreconditions: ScrollPreconditions = {
          requireHistory:
            scenario.startsWith('history-') ||
            scenario.endsWith('-history') ||
            gestureCase,
          requireInitialEnd:
            !!targetCommand ||
            (assertion === 'bottom' &&
              !scenario.startsWith('entry-') &&
              scenario !== 'empty-first-post'),
          requireReadingAnchor: assertion === 'hold' || gestureCase,
          readingAnchorKey: anchor?.key,
          excludedAnchorKeys: [
            loadedImageKey,
            typeof mutationKey === 'string' ? mutationKey : undefined,
          ].filter((key): key is string => key !== undefined),
          initialTailKey: originalPosts.at(-1)?.id,
          allowEmptyEnd:
            originalPosts.length === 0 &&
            scenario === 'thinking-empty-show-hide',
        };
        const preconditions = assessScrollPreconditions(
          baseline,
          baselinePreconditions
        );
        if (result && mutationWitness?.verdict === 'FAIL') {
          result.issues.push(
            ...mutationWitness.issues.map((issue) => ({
              code: `mutation-semantic-${issue.code}`,
              kind: issue.kind,
              message: issue.code,
            }))
          );
          if (result.verdict !== 'INCOMPLETE') result.verdict = 'FAIL';
          result.passed = false;
        }
        if (
          result &&
          (!preconditions.established ||
            (mutationCase &&
              (!mutationWitness || mutationWitness.verdict === 'INCOMPLETE')))
        ) {
          result.issues.push(...preconditions.issues);
          if (
            mutationCase &&
            (!mutationWitness || mutationWitness.verdict === 'INCOMPLETE')
          )
            incomplete(
              'mutation-not-witnessed',
              mutationWitness?.reasons.join(', ') ??
                'Mutation evidence is missing.'
            );
          // Preserve diagnostic residuals, but invalid setup or an unobserved
          // intended mutation cannot establish a product regression.
          result.verdict = 'INCOMPLETE';
          result.passed = false;
        }
        if (
          result &&
          nativeLatestVisibilityInputs &&
          (!Number.isFinite(initialWindowHeight) ||
            initialWindowHeight <= 0 ||
            nativeLatestVisibilityInputs.after.windowHeight !==
              initialWindowHeight ||
            nativeLatestVisibilityInputs.changes.some(
              (change) => change.windowHeight !== initialWindowHeight
            ))
        ) {
          result.issues.push({
            code: 'native-window-height-changed',
            kind: 'incomplete',
            message:
              'The fixed-window capture lost its declared native threshold geometry.',
          });
          result.verdict = 'INCOMPLETE';
          result.passed = false;
        }
        const trace: Trace = {
          scenario,
          runId: runId.current,
          productCoverage: 'local-component-fixture',
          ...(imageLoadGate
            ? {
                imageLoadGate,
                imageLoadWitness,
                imageLoadInteraction: imageInteraction,
              }
            : {}),
          ...(thinkingCase
            ? { thinkingCoverage: 'forced-label-layout-only' as const }
            : {}),
          ...(scenario.startsWith('near-')
            ? {
                positioningCoverage:
                  'programmatic-near-end-no-user-drag' as const,
              }
            : {}),
          assertion,
          baseline,
          samples,
          events: capturedEvents,
          assessment,
          result,
          fixtureVersion: FIXTURE_VERSION,
          assertionSchemaVersion: 1,
          ...(Platform.OS === 'ios'
            ? { nativeGeometrySchemaVersion: 1 as const }
            : {}),
          nativeSampledRulerContract,
          nativeCenterCommandContract,
          nativeOffscreenCommandContract,
          nativeLatestVisibilityInputs,
          nativeRecording,
          nativeCorrections: nativeCorrectionOwner
            ? {
                ...nativeCorrectionOwner.read(),
                ...(correctionObservation.current !== nativeCorrectionOwner
                  ? {
                      status: 'unavailable' as const,
                      error: 'Diagnostic list owner changed during capture',
                    }
                  : {}),
              }
            : undefined,
          nativeRecordingContract,
          nativeMutationContract,
          nativePostGestureProbe,
          nativeMutationMarkerTransfer,
          nativeEntryContract,
          nativeEntryMarkerTransfers: nativeEntryContract
            ? nativeEntryMarkerTransfers
            : undefined,
          nativeRecordingTransfer,
          nativeRecordingAcquisition: nativeAcquisition
            ? {
                verdict: nativeAcquisition.verdict,
                issues: nativeAcquisition.issues,
                samples: nativeAcquisition.samples.length,
              }
            : undefined,
          expectations,
          baselinePreconditions,
          followingOffsetThroughout: followingThroughout && changedData,
          emptyEndThroughout: scenario === 'thinking-empty-show-hide',
          committedDataKeys,
          originalDataKeys: originalPosts.map((post) => post.id),
          baselineComposerHeight,
          mutationEvidence,
          mutationScope: preparedMutation
            ? `${attachedChannel.current ?? ''}::${generationRef.current}`
            : undefined,
          mutationWitness,
          imageLoadEvidence,
          platform: Platform.OS,
        };
        if (scenario === nativeCenterCommand.scenario) {
          for (const issue of nativeCenterCommandEvidenceIssues(trace))
            incomplete(
              issue,
              'The fixed native center command contract was not established.'
            );
        }
        if (scenario === nativeOffscreenCommand.scenario) {
          for (const issue of nativeOffscreenCommandEvidenceIssues(trace))
            incomplete(
              issue,
              'The fixed unmounted native target contract was not established.'
            );
        }
        traces.current.push(trace);
        new File(
          Paths.document,
          `scroll-stability-${runId.current}-${scenario}.json`
        ).write(JSON.stringify(trace));
        const verdict = result?.verdict ?? 'INCOMPLETE';
        setStatus(
          `${verdict} ${scenario}: ${assessment?.maxDriftPt.toFixed(1) ?? '?'}pt; ${result?.issues.map((i) => i.code).join(', ') ?? 'manual observation without an assertion'}`
        );
        return { scenario, verdict, result, samples: samples.length };
      } finally {
        windowSubscription?.remove();
        if (nativeRecordingOwned)
          await nativeRecordingModule!
            .stopScrollGeometryRecording(nativeRecordingContract!.recordingId)
            .catch(() => {});
        sampling.current = false;
        semanticTarget.current = null;
        requiredRows.current.clear();
      }
    },
    [event, snapshot, declareSampledRuler]
  );

  const position = useCallback(
    async (where: 'end' | 'near' | 'history' | 'top') => {
      const ref = list.current;
      const surface = commands.current;
      if (!ref || !surface) throw new Error('List commands are not ready');
      const result = await positionFixtureList(
        surface,
        () => ref.getState(),
        where,
        pause
      );
      event('positioned', {
        where,
        source: result.source,
        ...(result.postId ? { postId: result.postId } : {}),
      });
    },
    [event]
  );

  const prepareVisibleNonAnchorRow = useCallback(
    async (
      kind:
        | 'grow'
        | 'shrink'
        | 'reference'
        | 'media'
        | 'remove'
        | 'reaction'
        | 'reply'
        | 'cache'
    ): Promise<PreparedRowMutation> => {
      const before = await snapshot(declareSampledRuler(`history-${kind}`));
      const readingAnchor = chooseReadingAnchor(before);
      const visible = before.rows
        .filter(
          (row) =>
            row.key !== readingAnchor?.key &&
            row.y < before.viewportBottom &&
            row.y + row.height > before.viewportTop
        )
        .sort((a, b) => a.y - b.y);
      const visibleIndex = postsRef.current.findIndex(
        (post) => post.id === visible[0]?.key
      );
      const index = visibleIndex;
      const current = postsRef.current[index];
      if (!current) throw new Error('Mutation target not measured');
      const selection: PreparedRowMutation['selection'] = {
        kind,
        key: current.id,
        index,
        readingAnchorKey: readingAnchor?.key ?? '',
        readingAnchorIndex: postsRef.current.findIndex(
          (post) => post.id === readingAnchor?.key
        ),
        targetY: visible[0].y,
        ...(readingAnchor ? { readingAnchorY: readingAnchor.y } : {}),
        relation: readingAnchor
          ? visible[0].y < readingAnchor.y
            ? 'above'
            : 'below'
          : 'unmeasured',
      };
      if (kind === 'remove') {
        return {
          key: current.id,
          kind,
          selection,
          expected: { presence: 'absent' },
          apply: () =>
            update(postsRef.current.filter((post) => post.id !== current.id)),
        };
      }
      const content =
        kind === 'shrink'
          ? [verse.inline('Short edited post')]
          : kind === 'media'
            ? [
                block.image({
                  src: imageURI,
                  width: 320,
                  height: 520,
                  alt: 'Local delayed media fixture',
                }),
                verse.inline('Media dimensions became available'),
              ]
            : kind === 'reference'
              ? [
                  block.channelReference(
                    tlonLocalIntros.id,
                    referencedChatPost.id
                  ),
                  verse.inline(description.repeat(5)),
                ]
              : [verse.inline(description.repeat(22))];
      const next: db.Post = {
        ...current,
        content:
          kind === 'reaction' || kind === 'reply'
            ? current.content
            : JSON.stringify(content),
        textContent:
          kind === 'reaction' || kind === 'reply' || kind === 'cache'
            ? current.textContent
            : kind === 'shrink'
              ? 'Short edited post'
              : description.repeat(22),
        reactions:
          kind === 'reaction'
            ? [
                {
                  postId: current.id,
                  contactId: initialContacts[0].id,
                  value: ':heart:',
                },
              ]
            : current.reactions,
        replyCount: kind === 'reply' ? 10 : current.replyCount,
        replyTime:
          kind === 'reply' ? (current.sentAt ?? 0) + 60_000 : current.replyTime,
        replyContactIds:
          kind === 'reply' ? [initialContacts[0].id] : current.replyContactIds,
        ...(kind !== 'cache'
          ? {
              hasImage: kind === 'media',
              hasChannelReference: kind === 'reference',
            }
          : {}),
      };
      return {
        key: current.id,
        kind,
        selection,
        expected: { presence: 'present', signature: mutationSignature(next) },
        apply: () => {
          if (kind === 'cache') {
            queryClient.setQueryData(['post', current.id], next);
            event('cache-change', { key: current.id });
          } else
            update(
              postsRef.current.map((post) =>
                post.id === current.id ? next : post
              )
            );
        },
      };
    },
    [event, snapshot, declareSampledRuler, update]
  );

  const changeVisibleNonAnchorRow = useCallback(
    async (kind: PreparedRowMutation['kind']) => {
      const prepared = await prepareVisibleNonAnchorRow(kind);
      event('row-change', prepared.selection);
      event('row-mutation-request', { key: prepared.key, kind });
      if (kind !== 'remove') requiredRows.current.add(prepared.key);
      prepared.apply();
    },
    [event, prepareVisibleNonAnchorRow]
  );

  const reset = useCallback(
    async (
      mode: 'latest' | 'selected' | 'empty' | 'delayed' = 'latest',
      entryMarkers?: NativeEntryActionMarkers
    ) => {
      await entryMarkers?.reset();
      if (mode !== 'delayed') await entryMarkers?.data();
      Keyboard.dismiss();
      event('reset', { mode });
      setSelectedPostId(mode === 'selected' ? 'scroll-fixture-65' : undefined);
      setThinking(mode === 'empty' ? 'Thinking…' : undefined);
      setLoading(mode === 'delayed');
      nextIndex.current = 120;
      update(
        mode === 'empty' || mode === 'delayed'
          ? []
          : Array.from({ length: 90 }, (_, i) => makePost(i + 30))
      );
      setGeneration((value) => value + 1);
      if (mode === 'delayed') {
        await pause(900);
        await entryMarkers?.data();
        update(Array.from({ length: 90 }, (_, i) => makePost(i + 30)));
        setLoading(false);
      }
      await pause(1200);
    },
    [event, update]
  );

  const waitUntil = useCallback(
    async (condition: () => boolean, message: string, timeout = 1800) => {
      const deadline = performance.now() + timeout;
      while (!disposed.current && performance.now() < deadline) {
        if (condition()) return;
        await pause(25);
      }
      throw new Error(message);
    },
    []
  );

  const configureNativeReadTiming = useCallback(
    async (session?: string) => {
      setNativeReadTimingSession(session);
      await waitUntil(
        () => committedTimingSession.current === session,
        'The native timing diagnostic session did not commit.'
      );
    },
    [waitUntil]
  );

  const transitionThinking = useCallback(
    async (label?: string) => {
      const visible = label !== undefined;
      const expectedHeight = visible ? 52 : 0;
      const layoutChange = thinkingEvidence.current.height !== expectedHeight;
      const requestedAt = performance.now();
      event('thinking-request', { visible, label: label ?? '', layoutChange });
      setThinking(label);
      await waitUntil(() => {
        const actual = thinkingEvidence.current;
        return (
          actual.committedAt >= requestedAt &&
          actual.visible === visible &&
          (!visible || actual.label === label) &&
          actual.height === expectedHeight &&
          (!layoutChange || actual.laidOutAt >= requestedAt)
        );
      }, 'Production ThinkingState did not commit and lay out the expected forced label.');
    },
    [event, waitUntil]
  );

  const appendCommitted = useCallback(async () => {
    await append();
    const expectedId = postsRef.current.at(-1)?.id;
    await waitUntil(
      () =>
        list.current
          ?.getState()
          .data.some((item) => (item.post?.id ?? item.id) === expectedId) ===
        true,
      'The response row was not committed to the production list.'
    );
    event('response-committed', { key: expectedId ?? '' });
  }, [append, event, waitUntil]);

  const prepareGatedImage = useCallback(
    async (name: string, where: 'end' | 'history'): Promise<ImageLoadGate> => {
      await position(where);
      const before = await snapshot(declareSampledRuler(name));
      const readingAnchor = chooseReadingAnchor(before);
      const candidate = before.rows
        .filter(
          (row) =>
            row.key !== readingAnchor?.key &&
            row.y < before.viewportBottom &&
            row.y + row.height > before.viewportTop
        )
        .sort((a, b) => a.y - b.y)[0];
      if (!candidate)
        throw new Error('No separate visible image-mutation row is available.');
      const token = encodeURIComponent(
        `${runId.current || Date.now()}-${name}-${Date.now()}`
      );
      const src = `${assetOrigin}/image/${token}.png`;
      update(
        postsRef.current.map((post) =>
          post.id === candidate.key
            ? {
                ...post,
                content: JSON.stringify([
                  block.image({
                    src,
                    width: 0,
                    height: 0,
                    alt: 'Gated native image load',
                  }),
                ]),
                hasImage: true,
              }
            : post
        )
      );
      let requested = false;
      let pendingAt = 0;
      for (let attempt = 0; attempt < 15; attempt++) {
        const status = await (await assetRequest(`/status/${token}`)).json();
        if (status.requested && !status.released) {
          requested = true;
          pendingAt = performance.now();
          break;
        }
        await pause(100);
      }
      if (!requested)
        throw new Error(
          'Image request did not reach its unreleased native asset gate.'
        );
      if (where === 'history' && readingAnchor) {
        const surface = commands.current;
        if (!surface) throw new Error('List commands are not ready');
        surface.scrollToPost({
          postId: readingAnchor.key,
          viewPosition: 0.5,
          animated: false,
        });
      } else {
        await position('end');
      }
      await pause(250);
      return {
        key: candidate.key,
        src,
        token,
        pendingAt,
        requested: true,
        released: false,
      };
    },
    [position, snapshot, declareSampledRuler, update]
  );
  const releaseGatedImage = useCallback(
    async (gate: ImageLoadGate) => {
      event('image-release-request', { key: gate.key, src: gate.src });
      await assetRequest(`/release/${gate.token}`, 'POST');
      event('image-release', { key: gate.key, src: gate.src });
    },
    [event]
  );

  const run = useCallback(
    async (name: string) => {
      const kind = name.split('-').at(-1);
      if (
        name === nativeCenterCommand.scenario ||
        name === nativeOffscreenCommand.scenario
      ) {
        const offscreen = name === nativeOffscreenCommand.scenario;
        const command = offscreen
          ? nativeOffscreenCommand
          : nativeCenterCommand;
        if (offscreen) await reset();
        else await position('end');
        return capture(
          name,
          'target',
          () => {
            const surface = commands.current;
            if (!surface) throw new Error('List commands are not ready');
            const mountedKeys = [...rows.current.keys()];
            if (offscreen && mountedKeys.includes(command.key))
              throw new Error(
                'Offscreen target is already mounted before request'
              );
            event(
              offscreen
                ? 'offscreen-command-request'
                : 'center-command-request',
              {
                scope: `${attachedChannel.current ?? ''}::${generationRef.current}`,
                key: command.key,
                viewPosition: command.viewPosition,
                animated: command.animated,
                source: 'PostList.scrollToPost',
                ...(offscreen
                  ? { mountedKeys: JSON.stringify(mountedKeys) }
                  : {}),
              }
            );
            surface.scrollToPost({
              postId: command.key,
              viewPosition: command.viewPosition,
              animated: command.animated,
            });
          },
          command.durationMs,
          command.key
        );
      }
      if (name.startsWith('entry-'))
        return capture(
          name,
          kind === 'selected'
            ? 'target'
            : kind === 'empty'
              ? 'observe'
              : 'bottom',
          (entryMarkers) =>
            reset(
              kind as 'latest' | 'selected' | 'empty' | 'delayed',
              entryMarkers
            ),
          2800,
          kind === 'selected' ? 'scroll-fixture-65' : undefined
        );
      if (name === 'empty-first-post') {
        await reset('empty');
        return capture(name, 'bottom', async () => {
          await pause(400);
          setThinking(undefined);
          await append();
        });
      }
      if (name === 'thinking-empty-show-hide') {
        await reset('empty');
        await transitionThinking(undefined);
        return capture(
          name,
          'bottom',
          async () => {
            await transitionThinking('Thinking...');
            await pause(150);
            await transitionThinking(undefined);
          },
          2200
        );
      }
      if (
        /^thinking-(show-hide|label|handoff-(message-first|same-frame|hide-first))-(end|history)$/.test(
          name
        )
      ) {
        const where = name.endsWith('-history') ? 'history' : 'end';
        const isHandoff = name.includes('-handoff-');
        const isLabel = name.startsWith('thinking-label-');
        if (isHandoff || isLabel) await transitionThinking('Thinking...');
        await position(where);
        return capture(
          name,
          where === 'history' ? 'hold' : 'bottom',
          async () => {
            if (isLabel) {
              await transitionThinking(
                'Thinking through a longer response and checking the details...'
              );
              await transitionThinking('Thinking...');
            } else if (name.includes('message-first')) {
              await appendCommitted();
              await pause(150);
              await transitionThinking(undefined);
            } else if (name.includes('same-frame')) {
              await Promise.all([
                transitionThinking(undefined),
                appendCommitted(),
              ]);
            } else if (name.includes('hide-first')) {
              await transitionThinking(undefined);
              await pause(150);
              await appendCommitted();
            } else {
              await transitionThinking('Thinking...');
              await pause(150);
              await transitionThinking(undefined);
            }
          },
          2400
        );
      }
      if (/^armed-post-gesture-thinking-(end|away)$/.test(name)) {
        const initialThinking = thinkingEvidence.current;
        if (initialThinking.visible || initialThinking.height !== 0)
          await transitionThinking(undefined);
        await waitUntil(
          () =>
            !thinkingEvidence.current.visible &&
            thinkingEvidence.current.height === 0 &&
            thinkingEvidence.current.committedAt > 0 &&
            thinkingEvidence.current.laidOutAt > 0,
          'The hidden thinking baseline has not committed and laid out.'
        );
        await position('end');
        return capture(
          name,
          'observe',
          async () => {
            await transitionThinking('Thinking...');
            await pause(100);
            await transitionThinking(undefined);
          },
          4500
        );
      }
      if (/^armed-thinking-(keyboard-(end|history)|gesture)$/.test(name)) {
        const keyboardRace = name.includes('-keyboard-');
        const where = name.endsWith('-end') ? 'end' : 'history';
        await position(where);
        return capture(
          name,
          keyboardRace ? (where === 'end' ? 'bottom' : 'hold') : 'gesture',
          async () => {
            const armedAt = performance.now();
            event('thinking-race-armed');
            setStatus(`Armed ${name}`);
            await waitUntil(
              () =>
                events.current.some(
                  (e) =>
                    e.time >= armedAt &&
                    (keyboardRace
                      ? /^keyboardWill(Show|Hide)$/.test(e.name)
                      : e.name === 'drag-begin')
                ),
              'The armed scenario received no real keyboard/drag start.',
              2800
            );
            await transitionThinking('Thinking...');
            await pause(100);
            await transitionThinking('Checking...');
            await pause(100);
            await transitionThinking(undefined);
          },
          4500
        );
      }
      if (
        /^armed-image-load-(gesture|keyboard-(history|end)|composer-(history|end))$/.test(
          name
        )
      ) {
        const interaction: ImageLoadInteraction = name.includes('-keyboard-')
          ? 'keyboard'
          : name.includes('-composer-')
            ? 'composer'
            : 'gesture';
        const where = name.endsWith('-end') ? 'end' : 'history';
        const gate = await prepareGatedImage(name, where);
        return capture(
          name,
          interaction === 'gesture'
            ? 'gesture'
            : where === 'end'
              ? 'bottom'
              : 'hold',
          async () => {
            const armedAt = performance.now();
            event('image-load-race-armed', { key: gate.key, interaction });
            setStatus(`Armed ${name}`);
            await waitUntil(
              () =>
                events.current.some(
                  (e) =>
                    e.time >= armedAt &&
                    (interaction === 'keyboard'
                      ? /^keyboardWill(Show|Hide)$/.test(e.name)
                      : e.name ===
                        (interaction === 'composer'
                          ? 'composer-input'
                          : 'drag-begin'))
                ),
              'No real interaction triggered the armed native image release.',
              2800
            );
            await releaseGatedImage(gate);
          },
          4500,
          undefined,
          gate.key,
          gate
        );
      }
      if (/^stateful-image-load-(history|end)$/.test(name)) {
        const where = name.endsWith('-history') ? 'history' : 'end';
        const gate = await prepareGatedImage(name, where);
        return capture(
          name,
          where === 'history' ? 'hold' : 'bottom',
          () => releaseGatedImage(gate),
          2400,
          undefined,
          gate.key,
          gate
        );
      }
      if (name === 'prepend-history') {
        await position('history');
        return capture(name, 'hold', () =>
          update([
            ...Array.from({ length: 20 }, (_, i) => makePost(i + 10)),
            ...postsRef.current,
          ])
        );
      }
      if (/^(append|burst)-(end|history)$/.test(name)) {
        await position(name.endsWith('-end') ? 'end' : 'history');
        return capture(
          name,
          name.endsWith('-end') ? 'bottom' : 'hold',
          async () => {
            for (let i = 0; i < (name.startsWith('burst') ? 10 : 1); i++) {
              await append();
              await pause(20);
            }
          }
        );
      }
      if (
        /^(near|history)-(grow|shrink|reference|media|remove|reaction|reply|cache)$/.test(
          name
        )
      ) {
        await position(name.startsWith('near') ? 'near' : 'history');
        const prepared = await prepareVisibleNonAnchorRow(
          kind as
            | 'grow'
            | 'shrink'
            | 'reference'
            | 'media'
            | 'remove'
            | 'reaction'
            | 'reply'
            | 'cache'
        );
        return capture(
          name,
          'hold',
          undefined,
          1800,
          undefined,
          undefined,
          undefined,
          prepared
        );
      }
      if (name === 'dismiss-history') {
        await position('history');
        return capture(name, 'hold', () => Keyboard.dismiss());
      }
      if (/^(keyboard|composer)-(history|end)$/.test(name)) {
        await position(name.endsWith('-history') ? 'history' : 'end');
        // The device runner now performs the actual focus/type interaction.
        // A capture without those causal events stays INCOMPLETE.
        return capture(
          name,
          name.endsWith('-history') ? 'hold' : 'bottom',
          undefined,
          4500
        );
      }
      if (name === 'gesture') {
        await position('history');
        return capture(name, 'gesture', undefined, 4500);
      }
      if (name === 'armed-growth') {
        return capture(
          name,
          'observe',
          async () => {
            await pause(1000);
            if (!disposed.current) await changeVisibleNonAnchorRow('grow');
          },
          4500
        );
      }
      if (name === 'keyboard' || name === 'media-return')
        return capture(name, 'observe', undefined, 4500);
      throw new Error(`Unknown scenario: ${name}`);
    },
    [
      append,
      appendCommitted,
      capture,
      changeVisibleNonAnchorRow,
      prepareVisibleNonAnchorRow,
      event,
      position,
      prepareGatedImage,
      releaseGatedImage,
      reset,
      transitionThinking,
      update,
      waitUntil,
    ]
  );

  const runSuite = useCallback(
    async (
      id = String(Date.now()),
      names: readonly string[] = automatedScenarios,
      withCorrections = false,
      timingSession?: string
    ) => {
      const selectedScenarios = selectFixtureSuiteScenarios(names);
      if (suiteRunning.current) throw new Error('Suite already running');
      suiteRunning.current = true;
      correctionsEnabled.current = withCorrections;
      runId.current = id;
      traces.current = [];
      const results: unknown[] = [];
      try {
        await configureNativeReadTiming(timingSession);
        for (const name of selectedScenarios) {
          try {
            await reset();
            events.current = [];
            results.push(await run(name));
          } catch (error) {
            results.push({
              scenario: name,
              verdict: 'INCOMPLETE',
              error: String(error),
            });
          }
        }
        new File(Paths.document, `scroll-stability-suite-${id}.json`).write(
          JSON.stringify({
            runId: id,
            fixtureVersion: FIXTURE_VERSION,
            platform: Platform.OS,
            productCoverage: 'local-component-fixture',
            evidenceLevel: 'sampled-geometry',
            nativeFrames: 'INCOMPLETE',
            nativeReadTimingSession: timingSession,
            selectedScenarios,
            results,
          })
        );
        setStatus(`Suite complete: ${results.length} cases; see JSON report`);
        return results;
      } finally {
        correctionObservation.current?.dispose();
        correctionsEnabled.current = false;
        suiteRunning.current = false;
        setNativeReadTimingSession(undefined);
      }
    },
    [reset, run, configureNativeReadTiming]
  );

  useEffect(() => {
    disposed.current = false;
    return () => {
      disposed.current = true;
    };
  }, []);
  useEffect(() => {
    const api = {
      run,
      runSuite,
      reset,
      position,
      snapshot,
      capture,
      traces: () => traces.current,
      events: () => events.current,
      clear: () => {
        traces.current = [];
        events.current = [];
      },
    };
    (
      globalThis as unknown as { __scrollStability?: typeof api }
    ).__scrollStability = api;
    const subscriptions = [
      'keyboardWillShow',
      'keyboardDidShow',
      'keyboardWillHide',
      'keyboardDidHide',
    ].map((name) =>
      Keyboard.addListener(name as 'keyboardDidShow', (e) =>
        event(name, { height: e.endCoordinates.height, duration: e.duration })
      )
    );
    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      delete (globalThis as unknown as { __scrollStability?: typeof api })
        .__scrollStability;
    };
  }, [capture, event, position, reset, run, runSuite, snapshot]);

  useEffect(() => {
    let cancelled = false;
    const dispatch = async (url: string) => {
      if (!url.includes('scroll-stability')) return;
      const parsed = new URL(url);
      const scenario = parsed.searchParams.get('scenario');
      const id = parsed.searchParams.get('runId');
      const target = parsed.searchParams.get('position');
      for (let attempt = 0; !list.current && attempt < 20; attempt++)
        await pause(150);
      if (cancelled) return;
      try {
        const suiteNames = parseFixtureSuiteRequest(parsed.searchParams);
        const withCorrections = parseFixtureCorrectionDiagnostics(
          parsed.searchParams
        );
        const timingSession = parseFixtureNativeReadTimingSession(
          parsed.searchParams
        );
        if (suiteNames) {
          await runSuite(
            id ?? undefined,
            suiteNames,
            withCorrections,
            timingSession
          );
          return;
        }
        if (suiteRunning.current) throw new Error('Suite already running');
        if (id) runId.current = id;
        await configureNativeReadTiming(timingSession);
        try {
          if (target)
            await position(target as 'end' | 'near' | 'history' | 'top');
          if (scenario) await run(scenario);
        } finally {
          setNativeReadTimingSession(undefined);
        }
      } catch (error) {
        setStatus(String(error));
      }
    };
    const listener = Linking.addEventListener(
      'url',
      ({ url }) => void dispatch(url)
    );
    void Linking.getInitialURL().then((url) => {
      if (url) void dispatch(url);
    });
    return () => {
      cancelled = true;
      listener.remove();
    };
  }, [position, run, runSuite, configureNativeReadTiming]);

  const scenarios = [
    ...automatedScenarios,
    'command-center',
    'command-offscreen',
    'entry-latest',
    'entry-selected',
    'entry-delayed',
    'empty-first-post',
    'near-grow',
    'history-grow',
    'near-reference',
    'history-reference',
    'near-media',
    'history-media',
    'history-remove',
    'prepend-history',
    'append-end',
    'append-history',
    'armed-growth',
    'keyboard',
    'keyboard-history',
    'keyboard-end',
    'composer-history',
    'composer-end',
    'armed-thinking-keyboard-end',
    'armed-thinking-keyboard-history',
    'armed-thinking-gesture',
    'armed-post-gesture-thinking-end',
    'armed-post-gesture-thinking-away',
    'armed-image-load-gesture',
    'armed-image-load-keyboard-end',
    'armed-image-load-keyboard-history',
    'armed-image-load-composer-end',
    'armed-image-load-composer-history',
    'dismiss-history',
    'gesture',
    'media-return',
  ];
  return (
    <RuntimeContext.Provider value={runtime}>
      <ConversationListDiagnosticsContext.Provider value={diagnostics}>
        <FixtureKit>
          <ScrollStabilityScreenHost>
            <View
              testID={NATIVE_ROOT_ID}
              accessibilityValue={{
                text: JSON.stringify({
                  version: 1,
                  scope: `${fixtureChannel.id}::${generation}`,
                  requestedKeys: posts.map((post) => post.id),
                }),
              }}
              collapsable={false}
              style={{ flex: 1 }}
            >
              <View
                style={{
                  height: 92,
                  paddingTop: 30,
                  backgroundColor: '#e7eef6',
                  paddingHorizontal: 8,
                }}
              >
                <Text
                  testID="scroll-stability-status"
                  numberOfLines={2}
                  style={{ fontSize: 11, color: '#15263d' }}
                >
                  {status}
                </Text>
                <View style={{ flexDirection: 'row' }}>
                  <Button title="Scenarios" onPress={() => setPanel(true)} />
                  <Button title="Latest" onPress={() => void position('end')} />
                  <Button
                    title="History"
                    onPress={() => void position('history')}
                  />
                  <Button title="Reset" onPress={() => void reset()} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <HeaderHeightContext.Provider value={0}>
                  <ChannelFixture
                    key={generation}
                    passedProps={() => ({
                      channel: fixtureChannel,
                      // Production queries supply newest first; ListPostCollection
                      // reverses that once for the upright native chat list.
                      posts: newestFirstPosts,
                      selectedPostId,
                      isLoadingPosts: loading,
                      pendingThinkingLabel: thinking,
                      onLoadOlderPosts: noop,
                      onLoadNewerPosts: noop,
                      goToMediaViewer: () => {
                        event('media-open');
                        setMedia(true);
                      },
                      onPressRef: (_channel, post) => {
                        event('reference-open', { key: post.id });
                        setSelectedPostId(post.id);
                      },
                      markRead: noop,
                    })}
                  />
                </HeaderHeightContext.Provider>
              </View>
              <Modal
                visible={panel}
                animationType="none"
                onRequestClose={() => setPanel(false)}
              >
                <View style={{ flex: 1, paddingTop: 60 }}>
                  <Button title="Close" onPress={() => setPanel(false)} />
                  <ScrollView>
                    {[...new Set(scenarios)].map((name) => (
                      <Button
                        key={name}
                        title={name}
                        onPress={() => {
                          setPanel(false);
                          void run(name).catch((error) =>
                            setStatus(String(error))
                          );
                        }}
                      />
                    ))}
                  </ScrollView>
                </View>
              </Modal>
              <Modal
                visible={media}
                animationType="fade"
                onRequestClose={() => setMedia(false)}
              >
                <View
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    backgroundColor: '#182537',
                  }}
                >
                  <Text style={{ color: 'white', textAlign: 'center' }}>
                    Fixture media destination
                  </Text>
                  <Button
                    title="Return to conversation"
                    onPress={() => {
                      event('media-close');
                      setMedia(false);
                    }}
                  />
                </View>
              </Modal>
            </View>
          </ScrollStabilityScreenHost>
        </FixtureKit>
      </ConversationListDiagnosticsContext.Provider>
    </RuntimeContext.Provider>
  );
}

export default <ScrollStabilityFixture />;
