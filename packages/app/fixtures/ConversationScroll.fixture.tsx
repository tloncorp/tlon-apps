import { HeaderHeightContext } from '@react-navigation/elements';
import { queryClient } from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/db';
import { da, render } from '@urbit/aura';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  scrollDiagRecorder,
  setScrollDiagnosticsEnabled,
  subscribeToScrollDiagRows,
} from '../ui/components/Channel/PostList/scrollDiagnostics';
import {
  type ScrollDiagEvent,
  formatScrollDiagEvent,
  formatScrollDiagEvents,
} from '../ui/components/Channel/PostList/scrollDiagnosticsCore';
import { ChannelFixture } from './Channel.fixture';
import {
  createCodeContent,
  createFakePost,
  createImageContent,
  createSimpleContent,
  initialContacts,
  tlonLocalIntros,
} from './fakeData';

/**
 * A conversation whose data can be changed on demand, for reproducing scroll
 * flicker and jumps with the scroll diagnostics on. Every post is a pure
 * function of its number, so a reload lays out identically and a jump can be
 * reproduced at the same place.
 *
 * Each fixture below starts the same conversation in a different situation.
 * The panel in the top right counts flagged events and applies changes; the
 * full timeline goes to the `scroller` logger and `globalThis.__scrollDiag`.
 *
 * The same changes can be driven from the debugger through
 * `globalThis.__scrollLab`, so a script can time them against gestures:
 * `__scrollLab.script([[0, 'stream', { steps: 120, everyMs: 90 }], [900, 'receive', 3]])`.
 */

const CURRENT_USER_ID = '~zod';
const BASE_TIME = Date.UTC(2026, 0, 15, 15, 0, 0);
const POST_INTERVAL_MS = 45_000;
const HEADER_HEIGHT = 103;

const sentences = [
  'ok',
  'that works for me',
  'I think the second option is the one to go with.',
  'Did anyone look at the build from last night? It seemed slower to open than the one before it.',
  'We should write down what we decided so nobody has to scroll back through all of this to find it later on.',
  'The longer version: it depends on whether the list has measured the rows above the one you are looking at. If it has not, every row that turns out taller or shorter than the estimate moves everything below it, and the list has to move the scroll offset by the same amount in the same frame to hide that.',
];

function seeded(seed: number) {
  let state = (seed * 2654435761 + 17) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function paragraphs(random: () => number, count: number) {
  return JSON.stringify(
    Array.from({ length: count }, () => ({
      inline: [sentences[Math.floor(random() * sentences.length)]],
    }))
  );
}

// A reply being streamed: the same text, a few more words of it each time, so
// the row only ever grows and does so a line at a time.
const streamWords = sentences.slice(2).join(' ').split(' ');

function streamedContent(wordCount: number) {
  const paragraphLength = 60;
  const blocks: { inline: string[] }[] = [];
  for (let start = 0; start < wordCount; start += paragraphLength) {
    const words: string[] = [];
    for (let i = start; i < Math.min(wordCount, start + paragraphLength); i++) {
      words.push(streamWords[i % streamWords.length]);
    }
    blocks.push({ inline: [words.join(' ')] });
  }
  return JSON.stringify(blocks);
}

// An image block with no stored size takes its height from the image once it
// loads, which is one of the ways a row changes height after it is on screen.
function createUnsizedImageContent(postNumber: number) {
  const height = 300 + (Math.abs(postNumber) % 5) * 120;
  return JSON.stringify([
    {
      block: {
        image: {
          src: `https://picsum.photos/seed/scroll-${postNumber}/600/${height}`,
          height: 0,
          width: 0,
          alt: '',
        },
      },
    },
  ]);
}

function contentFor(postNumber: number) {
  const random = seeded(postNumber);
  const roll = random();
  if (roll < 0.4) {
    return createSimpleContent(sentences[Math.floor(random() * 3)]);
  }
  if (roll < 0.65) {
    return paragraphs(random, 1 + Math.floor(random() * 2));
  }
  if (roll < 0.8) {
    return paragraphs(random, 4 + Math.floor(random() * 5));
  }
  if (roll < 0.87) {
    return createCodeContent(
      Array.from(
        { length: 3 + Math.floor(random() * 10) },
        (_, line) => `const value${line} = compute(${line});`
      ).join('\n')
    );
  }
  if (roll < 0.95) {
    return createImageContent(
      `https://picsum.photos/seed/sized-${postNumber}/536/350`
    );
  }
  return createUnsizedImageContent(postNumber);
}

// A quoted post or a link preview renders a short placeholder, then grows
// once it has loaded, and does so again each time its row is mounted after the
// cached result has been dropped. Late rows imitate that: the list's data
// holds the placeholder and the mounted row swaps in the full content.
const lateRows = { every: 0 };

function isLateRow(postNumber: number) {
  return lateRows.every > 0 && Math.abs(postNumber) % lateRows.every === 0;
}

function loadedLateContent(postNumber: number) {
  return paragraphs(seeded(postNumber + 7), 5);
}

function postNumberOf(post: db.Post) {
  return Math.round(
    ((post.sentAt ?? BASE_TIME) - BASE_TIME) / POST_INTERVAL_MS
  );
}

// Authors come in short runs so that grouping (the author header on the first
// message of a run) changes when a page is added above an existing row.
function authorFor(postNumber: number) {
  const run = Math.floor(postNumber / 3);
  const index = Math.floor(seeded(run)() * initialContacts.length);
  return initialContacts[index % initialContacts.length];
}

function makePost(postNumber: number, overrides?: Partial<db.Post>): db.Post {
  const sentAt = BASE_TIME + postNumber * POST_INTERVAL_MS;
  const author = authorFor(postNumber);
  return {
    ...createFakePost(
      'chat',
      isLateRow(postNumber)
        ? createSimpleContent('Quoted post loading…')
        : contentFor(postNumber)
    ),
    id: render('ud', da.fromUnix(sentAt)),
    authorId: author.id,
    author,
    sentAt,
    receivedAt: sentAt,
    reactions: [],
    replyCount: 0,
    replyTime: null,
    replyContactIds: [],
    ...overrides,
  };
}

function makeRange(first: number, last: number) {
  const posts: db.Post[] = [];
  // Channel takes posts newest first.
  for (let postNumber = last; postNumber >= first; postNumber--) {
    posts.push(makePost(postNumber));
  }
  return posts;
}

function withImagesAtEnd(posts: db.Post[]) {
  return posts.map((post, index) => {
    if (index === 1 || index === 3 || index === 6) {
      return {
        ...post,
        content: createImageContent(
          `https://picsum.photos/seed/end-${index}/536/350`
        ),
      };
    }
    if (index === 4) {
      return { ...post, content: createUnsizedImageContent(index) };
    }
    return post;
  });
}

function initialPosts(preset: Preset) {
  const page = preset.stalePage ?? preset;
  const posts = makeRange(page.first, page.last);
  return preset.imagesAtEnd ? withImagesAtEnd(posts) : posts;
}

/**
 * Something the real channel screen does around opening a conversation,
 * timed from the list mounting or from the list first being shown. A dev
 * build takes about a second to show the list where a release build takes a
 * fraction of that, so anchoring a step to the reveal is how to reproduce the
 * order of events a release build has.
 */
type OpenStep = {
  from: 'mount' | 'reveal';
  atMs: number;
  action:
    | // The transparent native header reports its height.
      'header'
    // The cached page from the last visit is replaced by a fresh read.
    | 'freshPage'
    // A background sync updates rows in place: reactions, reply counts, edits.
    | 'refresh'
    // The first page was too short to fill the screen, so another is loaded.
    | 'olderPage';
};

const headerBeforeReveal: OpenStep = {
  from: 'mount',
  atMs: 350,
  action: 'header',
};

type Preset = {
  /** Posts numbered `first..last` are the conversation's current page. */
  first: number;
  last: number;
  /**
   * Mount with this stale page instead, as left by the last visit; a
   * `freshPage` step then swaps in `first..last`.
   */
  stalePage?: { first: number; last: number };
  /** Put images in the newest few posts, where the conversation opens. */
  imagesAtEnd?: boolean;
  openSteps?: OpenStep[];
  /** Oldest post number that paging can reach. */
  oldest: number;
  /** Delay before an older page arrives. */
  pageLatencyMs: number;
  /** Open at this post as the first unread instead of at the end. */
  unreadPostNumber?: number;
  /** Open on a post that only arrives after `selectedArrivesAfterMs`. */
  selectedPostNumber?: number;
  selectedArrivesAfterMs?: number | null;
  /** The page being shown is not the newest one, as around a linked post. */
  hasNewerPosts?: boolean;
  /** Apply changes on a timer without touching the panel. */
  traffic?: 'incoming' | 'everything';
  /**
   * Every nth post grows `afterMs` after its row mounts, each time it mounts,
   * the way a quoted post does when it finishes loading.
   */
  lateRows?: { every: number; afterMs: number };
  /**
   * Keep the JS thread busy for `busyMs` out of every `everyMs`, to stand in
   * for a phone several times slower than the simulator's host.
   */
  jsLoad?: { busyMs: number; everyMs: number };
};

type StreamOptions = {
  /** How many updates the reply arrives in. */
  steps?: number;
  everyMs?: number;
  wordsPerStep?: number;
};

type Target = 'newest' | 'near' | 'far' | 'oldest';
const targets: Target[] = ['newest', 'near', 'far', 'oldest'];

function useEnableScrollDiagnostics() {
  // Must happen before the conversation below mounts, so do it while
  // rendering rather than in an effect.
  useState(() => {
    setScrollDiagnosticsEnabled(true);
    scrollDiagRecorder.clear();
    return null;
  });
  useEffect(() => () => setScrollDiagnosticsEnabled(null), []);
}

function useFlaggedEvents() {
  const [counts, setCounts] = useState(() => scrollDiagRecorder.getCounts());
  const [lastFlagged, setLastFlagged] = useState<ScrollDiagEvent | null>(null);
  useEffect(
    () =>
      scrollDiagRecorder.subscribe((event) => {
        if (event.flag) {
          setCounts(scrollDiagRecorder.getCounts());
          setLastFlagged(event);
        }
      }),
    []
  );
  const reset = useCallback(() => {
    scrollDiagRecorder.clear();
    setCounts(scrollDiagRecorder.getCounts());
    setLastFlagged(null);
  }, []);
  return { counts, lastFlagged, reset };
}

type LabAction = [label: string, run: () => void];

// Holds the flagged-event state itself so that a flagged event re-renders
// this panel and not the conversation being measured.
function LabPanel({ actions }: { actions: LabAction[] }) {
  const insets = useSafeAreaInsets();
  const { counts, lastFlagged, reset } = useFlaggedEvents();
  const [expanded, setExpanded] = useState(false);
  const dump = useCallback(() => {
    console.log(
      `[scroller] timeline\n${formatScrollDiagEvents(scrollDiagRecorder.getEvents())}`
    );
  }, []);
  const allActions: LabAction[] = [
    ...actions,
    ['Dump log', dump],
    ['Clear', reset],
  ];

  return (
    <View
      pointerEvents="box-none"
      style={[styles.panel, { top: insets.top + 52 }]}
    >
      <Pressable
        onPress={() => setExpanded((value) => !value)}
        style={styles.summary}
        testID="ScrollLabSummary"
      >
        <Text style={styles.summaryText}>
          {`jumps ${counts.jump} · flickers ${counts.flicker} · hitches ${counts.hitch} · warnings ${counts.warn} ${expanded ? '▾' : '▸'}`}
        </Text>
        {lastFlagged ? (
          <Text numberOfLines={expanded ? 6 : 2} style={styles.lastFlagged}>
            {formatScrollDiagEvent(lastFlagged)}
          </Text>
        ) : null}
      </Pressable>
      {expanded ? (
        <ScrollView style={styles.actions}>
          <View style={styles.actionGrid}>
            {allActions.map(([label, run]) => (
              <Pressable key={label} onPress={run} style={styles.action}>
                <Text style={styles.actionText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

function ScrollLab({ preset }: { preset: Preset }) {
  useEnableScrollDiagnostics();
  // Read while building posts, so it has to be set before the first ones are.
  useState(() => {
    lateRows.every = preset.lateRows?.every ?? 0;
    return null;
  });

  const selectedPost = useMemo(
    () =>
      preset.selectedPostNumber === undefined
        ? null
        : makePost(preset.selectedPostNumber),
    [preset.selectedPostNumber]
  );
  const [posts, setPosts] = useState(() => initialPosts(preset));
  const postsRef = useRef(posts);
  useLayoutEffect(() => {
    postsRef.current = posts;
  }, [posts]);
  const newestNumber = useRef((preset.stalePage ?? preset).last);
  const oldestNumber = useRef((preset.stalePage ?? preset).first);
  const isLoadingOlderRef = useRef(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasNewerPosts, setHasNewerPosts] = useState(
    preset.hasNewerPosts ?? false
  );
  const [hasOlderPosts, setHasOlderPosts] = useState(
    (preset.stalePage ?? preset).first > preset.oldest
  );
  const [thinkingLabel, setThinkingLabel] = useState<string | undefined>();
  const [target, setTarget] = useState<Target>('near');
  // The transparent native header reports its height after the channel
  // mounts, so the list's top inset changes once it is already laid out.
  const [headerHeight, setHeaderHeight] = useState(0);

  const updatePost = useCallback(
    (id: string, update: (post: db.Post) => db.Post) => {
      setPosts((current) =>
        current.map((post) => {
          if (post.id !== id) {
            return post;
          }
          const next = update(post);
          // Rows read their post through this cache once mounted.
          queryClient.setQueryData(['post', id], next);
          return next;
        })
      );
    },
    []
  );

  const pickTarget = useCallback(() => {
    const current = postsRef.current;
    const index = {
      newest: 0,
      near: 4,
      far: 30,
      oldest: current.length - 1,
    }[target];
    return current[Math.min(index, current.length - 1)];
  }, [target]);

  const receive = useCallback((count = 1) => {
    const added: db.Post[] = [];
    for (let i = 0; i < count; i++) {
      newestNumber.current += 1;
      added.unshift(makePost(newestNumber.current));
    }
    setPosts((current) => [...added, ...current]);
  }, []);

  const send = useCallback(() => {
    newestNumber.current += 1;
    const post = makePost(newestNumber.current, {
      authorId: CURRENT_USER_ID,
      author: null,
      content: createSimpleContent('Sending this from the fixture.'),
      deliveryStatus: 'pending',
    });
    setPosts((current) => [post, ...current]);
    setTimeout(
      () => updatePost(post.id, (p) => ({ ...p, deliveryStatus: 'sent' })),
      700
    );
  }, [updatePost]);

  const loadOlder = useCallback(
    (count = 20) => {
      if (isLoadingOlderRef.current || oldestNumber.current <= preset.oldest) {
        return;
      }
      isLoadingOlderRef.current = true;
      setIsLoadingOlder(true);
      setTimeout(() => {
        const last = oldestNumber.current - 1;
        const first = Math.max(preset.oldest, last - count + 1);
        oldestNumber.current = first;
        setPosts((current) => [...current, ...makeRange(first, last)]);
        setHasOlderPosts(first > preset.oldest);
        isLoadingOlderRef.current = false;
        setIsLoadingOlder(false);
      }, preset.pageLatencyMs);
    },
    [preset.oldest, preset.pageLatencyMs]
  );
  const loadOlderPage = useCallback(() => loadOlder(20), [loadOlder]);

  const resize = useCallback(
    (grow: boolean) => {
      const post = pickTarget();
      if (!post) {
        return;
      }
      updatePost(post.id, (p) => ({
        ...p,
        isEdited: true,
        content: grow
          ? paragraphs(seeded(p.sentAt ?? 0), 8)
          : createSimpleContent('ok'),
      }));
    },
    [pickTarget, updatePost]
  );

  const react = useCallback(() => {
    const post = pickTarget();
    if (!post) {
      return;
    }
    updatePost(post.id, (p) => ({
      ...p,
      reactions: p.reactions?.length
        ? []
        : [{ contactId: '~ten', postId: p.id, value: ':heart:' }],
    }));
  }, [pickTarget, updatePost]);

  const remove = useCallback(() => {
    const post = pickTarget();
    if (post) {
      updatePost(post.id, (p) => ({ ...p, isDeleted: true }));
    }
  }, [pickTarget, updatePost]);

  const stream = useCallback(
    ({ steps = 30, everyMs = 120, wordsPerStep = 5 }: StreamOptions = {}) => {
      newestNumber.current += 1;
      const post = makePost(newestNumber.current, {
        content: streamedContent(wordsPerStep),
      });
      setPosts((current) => [post, ...current]);
      let step = 1;
      const interval = setInterval(() => {
        step += 1;
        updatePost(post.id, (p) => ({
          ...p,
          content: streamedContent(step * wordsPerStep),
        }));
        if (step >= steps) {
          clearInterval(interval);
        }
      }, everyMs);
    },
    [updatePost]
  );

  const receiveUnsizedImage = useCallback(() => {
    newestNumber.current += 1;
    const post = makePost(newestNumber.current, {
      content: createUnsizedImageContent(newestNumber.current),
    });
    setPosts((current) => [post, ...current]);
  }, []);

  useEffect(() => {
    if (!selectedPost || preset.selectedArrivesAfterMs == null) {
      return;
    }
    const timeout = setTimeout(() => {
      const center = preset.selectedPostNumber!;
      oldestNumber.current = center - 20;
      newestNumber.current = center + 20;
      setPosts(makeRange(center - 20, center + 20));
      setHasNewerPosts(true);
    }, preset.selectedArrivesAfterMs);
    return () => clearTimeout(timeout);
  }, [preset.selectedArrivesAfterMs, preset.selectedPostNumber, selectedPost]);

  const swapInFreshPage = useCallback(() => {
    oldestNumber.current = preset.first;
    newestNumber.current = preset.last;
    setPosts(makeRange(preset.first, preset.last));
  }, [preset.first, preset.last]);

  const refreshRecentRows = useCallback(() => {
    const recent = postsRef.current.slice(0, 8);
    recent.forEach((post, index) => {
      if (index % 3 === 0) {
        updatePost(post.id, (p) => ({
          ...p,
          reactions: [{ contactId: '~ten', postId: p.id, value: ':heart:' }],
        }));
      } else if (index % 3 === 1) {
        updatePost(post.id, (p) => ({
          ...p,
          replyCount: 3,
          replyTime: p.sentAt,
          replyContactIds: ['~ten', '~bus'],
        }));
      }
    });
  }, [updatePost]);

  const openActionsRef = useRef({
    loadOlderPage,
    refreshRecentRows,
    swapInFreshPage,
  });
  useLayoutEffect(() => {
    openActionsRef.current = {
      loadOlderPage,
      refreshRecentRows,
      swapInFreshPage,
    };
  }, [loadOlderPage, refreshRecentRows, swapInFreshPage]);
  useEffect(() => {
    const steps = preset.openSteps ?? [headerBeforeReveal];
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const run = (action: OpenStep['action']) => {
      const actions = openActionsRef.current;
      switch (action) {
        case 'header':
          return setHeaderHeight(HEADER_HEIGHT);
        case 'freshPage':
          return actions.swapInFreshPage();
        case 'refresh':
          return actions.refreshRecentRows();
        case 'olderPage':
          return actions.loadOlderPage();
      }
    };
    const start = (from: OpenStep['from']) => {
      for (const step of steps) {
        if (step.from === from) {
          timeouts.push(setTimeout(() => run(step.action), step.atMs));
        }
      }
    };
    start('mount');
    let revealed = false;
    const unsubscribe = scrollDiagRecorder.subscribe((event) => {
      if (
        !revealed &&
        event.type === 'visibility' &&
        event.message.startsWith('list first shown')
      ) {
        revealed = true;
        start('reveal');
      }
    });
    return () => {
      unsubscribe();
      timeouts.forEach(clearTimeout);
    };
  }, [preset.openSteps]);

  // Timed changes, so the conversation can be scrolled by hand (or by a
  // script) while its content moves underneath.
  const actionsRef = useRef({ react, receive, resize, send });
  useLayoutEffect(() => {
    actionsRef.current = { react, receive, resize, send };
  }, [react, receive, resize, send]);
  useEffect(() => {
    if (!preset.traffic) {
      return;
    }
    let tick = 0;
    const interval = setInterval(() => {
      tick += 1;
      const actions = actionsRef.current;
      actions.receive(tick % 7 === 0 ? 4 : 1);
      if (preset.traffic !== 'everything') {
        return;
      }
      if (tick % 3 === 0) {
        actions.resize(tick % 2 === 0);
      }
      if (tick % 4 === 0) {
        actions.react();
      }
      if (tick % 5 === 0) {
        actions.send();
      }
      if (tick % 6 === 0) {
        setThinkingLabel((label) => (label ? undefined : 'Thinking…'));
      }
    }, 1300);
    return () => clearInterval(interval);
  }, [preset.traffic]);

  useEffect(() => {
    const late = preset.lateRows;
    if (!late) {
      return;
    }
    const pending = new Map<string, ReturnType<typeof setTimeout>>();
    const unsubscribe = subscribeToScrollDiagRows(
      tlonLocalIntros.id,
      ({ key, kind }) => {
        const post = postsRef.current.find(({ id }) => id === key);
        if (!post || !isLateRow(postNumberOf(post))) {
          return;
        }
        clearTimeout(pending.get(key));
        pending.delete(key);
        if (kind === 'unmount') {
          // Dropped from the cache, so the next mount loads it again.
          queryClient.setQueryData(['post', key], post);
          return;
        }
        pending.set(
          key,
          setTimeout(() => {
            pending.delete(key);
            queryClient.setQueryData(['post', key], {
              ...post,
              content: loadedLateContent(postNumberOf(post)),
            });
          }, late.afterMs)
        );
      }
    );
    return () => {
      unsubscribe();
      pending.forEach(clearTimeout);
    };
  }, [preset.lateRows]);

  const jsLoadRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const setJsLoad = useCallback((busyMs = 0, everyMs = 16) => {
    if (jsLoadRef.current !== null) {
      clearInterval(jsLoadRef.current);
      jsLoadRef.current = null;
    }
    if (busyMs > 0) {
      jsLoadRef.current = setInterval(() => {
        const until = performance.now() + busyMs;
        while (performance.now() < until) {
          // Spin: the point is to hold the thread.
        }
      }, everyMs);
    }
  }, []);
  useEffect(() => {
    setJsLoad(preset.jsLoad?.busyMs, preset.jsLoad?.everyMs);
    return () => setJsLoad(0);
  }, [preset.jsLoad, setJsLoad]);

  // Lets a script drive the same changes as the panel, timed against gestures.
  const labRef = useRef({
    loadOlderPage,
    react,
    receive,
    remove,
    resize,
    send,
    stream,
  });
  useLayoutEffect(() => {
    labRef.current = {
      loadOlderPage,
      react,
      receive,
      remove,
      resize,
      send,
      stream,
    };
  }, [loadOlderPage, react, receive, remove, resize, send, stream]);
  useEffect(() => {
    const handle = {
      receive: (count = 1) => labRef.current.receive(count),
      send: () => labRef.current.send(),
      stream: (options?: StreamOptions) => labRef.current.stream(options),
      older: () => labRef.current.loadOlderPage(),
      grow: () => labRef.current.resize(true),
      shrink: () => labRef.current.resize(false),
      react: () => labRef.current.react(),
      remove: () => labRef.current.remove(),
      target: (next: Target) => setTarget(next),
      thinking: (on: boolean) => setThinkingLabel(on ? 'Thinking…' : undefined),
      newer: (on: boolean) => setHasNewerPosts(on),
      header: (height: number) => setHeaderHeight(height),
      jsLoad: setJsLoad,
      /** Runs `[afterMs, action, ...args]` steps, each timed from now. */
      script: (steps: [number, string, ...unknown[]][]) => {
        for (const [afterMs, action, ...args] of steps) {
          setTimeout(() => {
            scrollDiagRecorder.record({
              list: 'lab',
              type: 'mark',
              message: `${action}(${args.map((arg) => JSON.stringify(arg)).join(', ')})`,
            });
            (handle as Record<string, (...rest: unknown[]) => void>)[action]?.(
              ...args
            );
          }, afterMs);
        }
      },
    };
    (globalThis as Record<string, unknown>).__scrollLab = handle;
    return () => {
      delete (globalThis as Record<string, unknown>).__scrollLab;
    };
  }, [setJsLoad]);

  const unread = useMemo((): db.ChannelUnread | null => {
    if (preset.unreadPostNumber === undefined) {
      return null;
    }
    const post = makePost(preset.unreadPostNumber);
    return {
      channelId: tlonLocalIntros.id,
      type: 'channel',
      notify: false,
      count: preset.last - preset.unreadPostNumber + 1,
      countWithoutThreads: preset.last - preset.unreadPostNumber + 1,
      updatedAt: post.sentAt,
      firstUnreadPostId: post.id,
    };
  }, [preset.last, preset.unreadPostNumber]);

  const actions: LabAction[] = [
    ['Receive', () => receive(1)],
    ['Burst ×5', () => receive(5)],
    ['Send', send],
    ['Stream', () => stream()],
    ['Long stream', () => stream({ steps: 120, everyMs: 90 })],
    ['Unsized image', receiveUnsizedImage],
    ['Older page', loadOlderPage],
    [
      `Target: ${target}`,
      () => setTarget(targets[(targets.indexOf(target) + 1) % targets.length]),
    ],
    ['Grow', () => resize(true)],
    ['Shrink', () => resize(false)],
    ['React', react],
    ['Delete', remove],
    [
      thinkingLabel ? 'Thinking off' : 'Thinking on',
      () => setThinkingLabel((label) => (label ? undefined : 'Thinking…')),
    ],
    [
      hasNewerPosts ? 'Newer: yes' : 'Newer: no',
      () => setHasNewerPosts((value) => !value),
    ],
    [
      headerHeight ? 'Header: 103' : 'Header: 0',
      () => setHeaderHeight((height) => (height ? 0 : HEADER_HEIGHT)),
    ],
  ];

  return (
    <HeaderHeightContext.Provider value={headerHeight}>
      <ChannelFixture
        negotiationMatch
        theme="light"
        passedProps={() => ({
          posts,
          isLoadingPosts: isLoadingOlder,
          hasNewerPosts,
          hasOlderPosts,
          onLoadOlderPosts: loadOlderPage,
          initialChannelUnread: unread,
          selectedPostId: selectedPost?.id,
          pendingThinkingLabel: thinkingLabel,
        })}
      />
      <LabPanel actions={actions} />
    </HeaderHeightContext.Provider>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    right: 8,
    width: 230,
  },
  summary: {
    backgroundColor: 'rgba(20, 20, 20, 0.88)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  summaryText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  lastFlagged: {
    color: '#ffd27a',
    fontSize: 10,
    marginTop: 4,
  },
  actions: {
    backgroundColor: 'rgba(20, 20, 20, 0.88)',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 260,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 8,
  },
  action: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  actionText: {
    color: 'white',
    fontSize: 12,
  },
});

const base: Preset = {
  first: 1,
  last: 120,
  oldest: -400,
  pageLatencyMs: 250,
};

export default {
  // Opens at the newest message with mixed row heights above it. Scroll up
  // through rows the list has only estimated.
  mixedHistory: <ScrollLab preset={base} />,
  // One screenful loaded; older pages arrive as the top is reached.
  pagedHistory: <ScrollLab preset={{ ...base, first: 91 }} />,
  // The same, with each page arriving late enough to hit the top first.
  pagedHistorySlowNetwork: (
    <ScrollLab preset={{ ...base, first: 91, pageLatencyMs: 1200 }} />
  ),
  // New messages keep arriving. Stay at the end, or scroll away and back.
  incomingMessages: <ScrollLab preset={{ ...base, traffic: 'incoming' }} />,
  // Messages arrive while rows resize, gain reactions and get sent.
  busyConversation: <ScrollLab preset={{ ...base, traffic: 'everything' }} />,
  // Two messages that grow into a full screen, crossing from end-aligned
  // short content to scrollable content.
  shortToLong: (
    <ScrollLab preset={{ ...base, first: 119, traffic: 'incoming' }} />
  ),
  // Opens at the first unread message, forty from the end.
  unreadAnchor: <ScrollLab preset={{ ...base, unreadPostNumber: 80 }} />,
  // The last message is the only unread one and is shorter than the screen,
  // so it cannot be brought to the top: the conversation has to settle at its
  // end with the unread marker in view, and follow the end from there.
  oneUnread: (
    <ScrollLab preset={{ ...base, first: 71, unreadPostNumber: 120 }} />
  ),
  // The unread run is a little taller than the screen: the first unread can
  // be brought to the top, and the end is less than a screen further down.
  // The conversation has to stay on the first unread while rows are measured,
  // images load and new messages arrive, rather than be taken to its end.
  unreadsJustOverAScreen: (
    <ScrollLab preset={{ ...base, first: 71, unreadPostNumber: 119 }} />
  ),
  unreadsOverAScreen: (
    <ScrollLab preset={{ ...base, first: 71, unreadPostNumber: 118 }} />
  ),
  unreadsOverAScreenWithImages: (
    <ScrollLab
      preset={{ ...base, first: 71, unreadPostNumber: 118, imagesAtEnd: true }}
    />
  ),
  unreadsOverAScreenThenIncoming: (
    <ScrollLab
      preset={{
        ...base,
        first: 71,
        unreadPostNumber: 118,
        traffic: 'incoming',
      }}
    />
  ),
  // About two screens of unread messages, on a short page that is topped up
  // once the list is showing.
  fewUnreads: (
    <ScrollLab preset={{ ...base, first: 71, unreadPostNumber: 117 }} />
  ),
  // The same with images in the unread messages still loading, and with new
  // messages arriving once it is open.
  fewUnreadsWithImages: (
    <ScrollLab
      preset={{ ...base, first: 71, unreadPostNumber: 117, imagesAtEnd: true }}
    />
  ),
  fewUnreadsThenIncoming: (
    <ScrollLab
      preset={{
        ...base,
        first: 71,
        unreadPostNumber: 117,
        traffic: 'incoming',
      }}
    />
  ),
  // The same on a phone several times slower.
  fewUnreadsSlowPhone: (
    <ScrollLab
      preset={{
        ...base,
        first: 71,
        unreadPostNumber: 117,
        jsLoad: { busyMs: 12, everyMs: 16 },
      }}
    />
  ),
  // Opens on a linked message whose page arrives after the list mounts.
  selectedPostArrivesLate: (
    <ScrollLab
      preset={{
        ...base,
        selectedPostNumber: -100,
        selectedArrivesAfterMs: 800,
      }}
    />
  ),
  // Opens on a linked message that never loads, so the list falls back to
  // the newest message after its timeout.
  selectedPostNeverArrives: (
    <ScrollLab
      preset={{
        ...base,
        selectedPostNumber: -100,
        selectedArrivesAfterMs: null,
      }}
    />
  ),
  // Opens on a linked message three rows from the top of its page, as a tap
  // on an Activity row or a notification does. The top is in reach straight
  // away, so older pages arrive while the list is showing and the message has
  // to stay where it landed.
  selectedPostNearTopOfPage: (
    <ScrollLab
      preset={{
        ...base,
        first: 60,
        last: 78,
        selectedPostNumber: 63,
        hasNewerPosts: true,
        pageLatencyMs: 400,
      }}
    />
  ),
  // The same on a phone several times slower.
  selectedPostNearTopSlowPhone: (
    <ScrollLab
      preset={{
        ...base,
        first: 60,
        last: 78,
        selectedPostNumber: 63,
        hasNewerPosts: true,
        pageLatencyMs: 400,
        jsLoad: { busyMs: 12, everyMs: 16 },
      }}
    />
  ),

  // The rest replay what the channel screen does around opening, in the
  // order a release build sees it: after the list is already on screen.

  // The header's height arrives once the list is showing.
  openHeaderAfterReveal: (
    <ScrollLab
      preset={{
        ...base,
        openSteps: [{ from: 'reveal', atMs: 120, action: 'header' }],
      }}
    />
  ),
  // The last visit's page shows first, then the fresh one replaces it: five
  // new messages at the end and five fewer at the top.
  openStalePageThenFresh: (
    <ScrollLab
      preset={{
        ...base,
        first: 71,
        stalePage: { first: 66, last: 115 },
        openSteps: [
          headerBeforeReveal,
          { from: 'reveal', atMs: 80, action: 'freshPage' },
        ],
      }}
    />
  ),
  // The same swap landing while the list is still hidden.
  openStalePageThenFreshEarly: (
    <ScrollLab
      preset={{
        ...base,
        first: 71,
        stalePage: { first: 66, last: 115 },
        openSteps: [
          headerBeforeReveal,
          { from: 'mount', atMs: 60, action: 'freshPage' },
        ],
      }}
    />
  ),
  // A background sync touches the newest rows shortly after opening.
  openThenRefresh: (
    <ScrollLab
      preset={{
        ...base,
        first: 71,
        openSteps: [
          headerBeforeReveal,
          { from: 'reveal', atMs: 400, action: 'refresh' },
        ],
      }}
    />
  ),
  // The first page is too short to fill the screen, so an older page is
  // requested straight away and lands once the list is showing.
  openShortPageThenOlder: (
    <ScrollLab
      preset={{
        ...base,
        first: 113,
        pageLatencyMs: 0,
        openSteps: [
          headerBeforeReveal,
          { from: 'reveal', atMs: 60, action: 'olderPage' },
        ],
      }}
    />
  ),
  // The same with the short page being unread messages: the list opens on
  // the first unread and must keep it in place when the older page lands.
  openUnreadShortPageThenOlder: (
    <ScrollLab
      preset={{
        ...base,
        first: 116,
        unreadPostNumber: 116,
        pageLatencyMs: 0,
        openSteps: [
          headerBeforeReveal,
          { from: 'reveal', atMs: 60, action: 'olderPage' },
        ],
      }}
    />
  ),
  // Images in the last few messages finish loading after the list shows.
  openImagesAtEnd: (
    <ScrollLab preset={{ ...base, first: 71, imagesAtEnd: true }} />
  ),
  // Scrolling and streaming scenarios. Drive these with `__scrollLab`.

  // Every sixth row grows a moment after it appears, each time it appears,
  // as quoted posts and link previews do. Scroll back through them.
  lateRowsInHistory: (
    <ScrollLab
      preset={{ ...base, first: 31, lateRows: { every: 6, afterMs: 120 } }}
    />
  ),
  // The same on a phone several times slower, where the list takes longer to
  // move the rows below a row that has just grown.
  lateRowsSlowPhone: (
    <ScrollLab
      preset={{
        ...base,
        first: 31,
        lateRows: { every: 6, afterMs: 120 },
        jsLoad: { busyMs: 12, everyMs: 16 },
      }}
    />
  ),
  // Paging back through history on a slower phone and a slower connection.
  pagedHistorySlowPhone: (
    <ScrollLab
      preset={{
        ...base,
        first: 91,
        pageLatencyMs: 600,
        jsLoad: { busyMs: 12, everyMs: 16 },
      }}
    />
  ),

  // Everything at once, as on a slow connection.
  openEverything: (
    <ScrollLab
      preset={{
        ...base,
        first: 71,
        stalePage: { first: 66, last: 115 },
        imagesAtEnd: true,
        openSteps: [
          { from: 'reveal', atMs: 60, action: 'header' },
          { from: 'reveal', atMs: 120, action: 'freshPage' },
          { from: 'reveal', atMs: 500, action: 'refresh' },
        ],
      }}
    />
  ),
};
