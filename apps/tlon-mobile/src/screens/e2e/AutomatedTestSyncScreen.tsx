import { AUTOMATED_TEST } from '@tloncorp/app/lib/envVars';
import { SyncPriority, createDevLogger, sync } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Button, LoadingSpinner, Text } from '@tloncorp/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { ScrollView, View, XStack, YStack, styled } from 'tamagui';

const logger = createDevLogger('e2eSyncChecks', false);
const E2E_SYNC_HOST = 'e2e';
const E2E_SYNC_PATH = '/sync';
const DUPLICATE_URL_WINDOW_MS = 1000;
const TEST_SYNC_CTX = { priority: SyncPriority.High, retry: true };

type SyncCheckId =
  | 'syncLatestChanges'
  | 'syncLatestPosts'
  | 'syncInitData'
  | 'syncInitialPosts';

type SyncCheckStatus = 'pending' | 'running' | 'pass' | 'fail';

type SyncCheckResult = {
  status: SyncCheckStatus;
  detail: string;
  durationMs: number | null;
};

const CHECK_LABELS: Record<SyncCheckId, string> = {
  syncLatestChanges: 'syncLatestChanges',
  syncLatestPosts: 'syncLatestPosts',
  syncInitData: 'syncInitData',
  syncInitialPosts: 'syncInitialPosts',
};

const CHECK_IDS: SyncCheckId[] = [
  'syncLatestChanges',
  'syncLatestPosts',
  'syncInitData',
  'syncInitialPosts',
];

function createPendingResult(): SyncCheckResult {
  return { status: 'pending', detail: 'Waiting to run', durationMs: null };
}

function createInitialResults(): Record<SyncCheckId, SyncCheckResult> {
  return {
    syncLatestChanges: createPendingResult(),
    syncLatestPosts: createPendingResult(),
    syncInitData: createPendingResult(),
    syncInitialPosts: createPendingResult(),
  };
}

function parseSyncCheckUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.host !== E2E_SYNC_HOST || parsed.pathname !== E2E_SYNC_PATH) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function formatDuration(durationMs: number | null) {
  if (durationMs == null) {
    return '';
  }

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  return `${(durationMs / 1000).toFixed(1)}s`;
}

async function runSyncLatestChangesCheck() {
  const syncFrom = Date.now() - 1000;
  await db.changesSyncedAt.setValue(syncFrom);
  const summary = await sync.syncLatestChanges({
    since: syncFrom,
    syncCtx: TEST_SYNC_CTX,
    callCtx: { cause: 'e2e-sync-methods' },
  });
  const syncedAt = await db.changesSyncedAt.getValue();
  if (syncedAt == null || syncedAt <= syncFrom) {
    throw new Error('changesSyncedAt did not advance');
  }

  return `changes synced, hadChanges=${summary.hadChanges ? 'yes' : 'no'}, posts=${summary.postsCount ?? 0}`;
}

async function runSyncLatestPostsCheck() {
  const syncFrom = Date.now() - 1000;
  await db.headsSyncedAt.setValue(syncFrom);
  await sync.syncLatestPosts(TEST_SYNC_CTX);
  const syncedAt = await db.headsSyncedAt.getValue();
  if (syncedAt == null || syncedAt <= syncFrom) {
    throw new Error('headsSyncedAt did not advance');
  }

  return `latest posts synced at ${new Date(syncedAt).toISOString()}`;
}

async function runSyncInitDataCheck() {
  await db.lastActivityAt.setValue(0);
  await sync.syncInitData(TEST_SYNC_CTX);
  const lastActivityAt = await db.lastActivityAt.getValue();
  if (lastActivityAt <= 0) {
    throw new Error('lastActivityAt did not update');
  }

  const groups = await db.getGroups({});
  return `init data synced, groups=${groups.length}`;
}

async function runSyncInitialPostsCheck() {
  await db.didSyncInitialPosts.setValue(false);
  await sync.syncInitialPosts({ syncSize: 'light' });
  const didSyncInitialPosts = await db.didSyncInitialPosts.getValue();
  if (!didSyncInitialPosts) {
    throw new Error('didSyncInitialPosts was not set');
  }

  const chats = await db.getChats();
  const chatCount = chats.pinned.length + chats.unpinned.length;
  return `initial posts synced, chats=${chatCount}`;
}

const CHECK_RUNNERS: Record<SyncCheckId, () => Promise<string>> = {
  syncLatestChanges: runSyncLatestChangesCheck,
  syncLatestPosts: runSyncLatestPostsCheck,
  syncInitData: runSyncInitDataCheck,
  syncInitialPosts: runSyncInitialPostsCheck,
};

export function AutomatedTestSyncScreen() {
  const [visible, setVisible] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] =
    useState<Record<SyncCheckId, SyncCheckResult>>(createInitialResults);
  const [overallStatus, setOverallStatus] =
    useState<SyncCheckStatus>('pending');
  const lastHandledUrlRef = useRef<{ url: string; handledAt: number } | null>(
    null
  );

  const runChecks = useCallback(async () => {
    setVisible(true);
    setIsRunning(true);
    setOverallStatus('running');
    setResults(createInitialResults());

    let hadFailures = false;
    for (const checkId of CHECK_IDS) {
      setResults((current) => ({
        ...current,
        [checkId]: {
          status: 'running',
          detail: 'Running...',
          durationMs: null,
        },
      }));

      const startedAt = Date.now();
      try {
        const detail = await CHECK_RUNNERS[checkId]();
        const durationMs = Date.now() - startedAt;
        setResults((current) => ({
          ...current,
          [checkId]: {
            status: 'pass',
            detail,
            durationMs,
          },
        }));
      } catch (error) {
        hadFailures = true;
        const durationMs = Date.now() - startedAt;
        const message =
          error instanceof Error ? error.message : 'Unknown sync failure';
        logger.error('sync check failed', checkId, error);
        setResults((current) => ({
          ...current,
          [checkId]: {
            status: 'fail',
            detail: message,
            durationMs,
          },
        }));
      }
    }

    setOverallStatus(hadFailures ? 'fail' : 'pass');
    setIsRunning(false);
  }, []);

  useEffect(() => {
    if (!AUTOMATED_TEST) {
      return;
    }

    const handleUrl = (url: string) => {
      const parsed = parseSyncCheckUrl(url);
      if (!parsed) {
        return;
      }

      const lastHandled = lastHandledUrlRef.current;
      const now = Date.now();
      if (
        lastHandled &&
        lastHandled.url === url &&
        now - lastHandled.handledAt < DUPLICATE_URL_WINDOW_MS
      ) {
        return;
      }

      lastHandledUrlRef.current = { url, handledAt: now };
      void runChecks();
    };

    Linking.getInitialURL().then((url) => {
      if (url) {
        handleUrl(url);
      }
    });

    const subscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    return () => subscription.remove();
  }, [runChecks]);

  if (!AUTOMATED_TEST || !visible) {
    return null;
  }

  return (
    <OverlayFrame testID="e2e-sync-test-screen">
      <CardFrame>
        <XStack alignItems="center" justifyContent="space-between" gap="$l">
          <YStack gap="$xs" flex={1}>
            <Text size="$label/xl" fontWeight="600" color="$primaryText">
              E2E Sync Checks
            </Text>
            <XStack alignItems="center" gap="$s">
              <StatusBadge tone={overallStatus}>
                <StatusText
                  tone={overallStatus}
                  testID="e2e-sync-test-overall-status"
                >
                  {overallStatus.toUpperCase()}
                </StatusText>
              </StatusBadge>
              {isRunning ? (
                <LoadingSpinner size="small" color="$primaryText" />
              ) : null}
            </XStack>
          </YStack>
        </XStack>

        <ScrollView maxHeight={360} showsVerticalScrollIndicator={false}>
          <YStack gap="$m" paddingRight="$xs">
            {CHECK_IDS.map((checkId) => {
              const result = results[checkId];
              return (
                <ResultRowFrame
                  key={checkId}
                  tone={result.status}
                  testID={`e2e-sync-test-row-${checkId}`}
                >
                  <XStack
                    alignItems="center"
                    justifyContent="space-between"
                    gap="$m"
                  >
                    <Text
                      flex={1}
                      size="$body"
                      fontWeight="600"
                      color="$primaryText"
                    >
                      {CHECK_LABELS[checkId]}
                    </Text>
                    <StatusBadge tone={result.status}>
                      <StatusText
                        tone={result.status}
                        testID={`e2e-sync-test-status-${checkId}`}
                      >
                        {result.status.toUpperCase()}
                      </StatusText>
                    </StatusBadge>
                  </XStack>
                  <ResultDetailText
                    tone={result.status}
                    testID={`e2e-sync-test-detail-${checkId}`}
                  >
                    {result.detail}
                    {result.durationMs != null
                      ? ` (${formatDuration(result.durationMs)})`
                      : ''}
                  </ResultDetailText>
                </ResultRowFrame>
              );
            })}
          </YStack>
        </ScrollView>

        <XStack justifyContent="flex-end" gap="$m">
          <Button
            preset="primary"
            size="small"
            disabled={isRunning}
            loading={isRunning}
            onPress={() => {
              void runChecks();
            }}
            label={isRunning ? 'Running...' : 'Run Again'}
            testID="e2e-sync-test-rerun"
          />
          <Button
            preset="outline"
            size="small"
            onPress={() => setVisible(false)}
            label="Close"
            testID="e2e-sync-test-close"
          />
        </XStack>
      </CardFrame>
    </OverlayFrame>
  );
}

const statusSurfaceVariants = {
  pending: {
    backgroundColor: '$secondaryBackground',
    borderColor: '$secondaryBorder',
  },
  running: {
    backgroundColor: '$systemNoticeBackground',
    borderColor: '$systemNoticeBorder',
  },
  pass: {
    backgroundColor: '$positiveBackground',
    borderColor: '$positiveBorder',
  },
  fail: {
    backgroundColor: '$negativeBackground',
    borderColor: '$negativeBorder',
  },
} as const;

const statusTextVariants = {
  pending: {
    color: '$tertiaryText',
  },
  running: {
    color: '$systemNoticeText',
  },
  pass: {
    color: '$positiveActionText',
  },
  fail: {
    color: '$negativeActionText',
  },
} as const;

const OverlayFrame = styled(YStack, {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  justifyContent: 'center',
  padding: '$l',
  backgroundColor: 'rgba(15, 23, 42, 0.55)',
});

const CardFrame = styled(YStack, {
  width: '100%',
  maxWidth: 640,
  maxHeight: '80%',
  alignSelf: 'center',
  gap: '$l',
  padding: '$2xl',
  borderRadius: '$xl',
  borderWidth: 1,
  borderColor: '$secondaryBorder',
  backgroundColor: '$background',
});

const ResultRowFrame = styled(YStack, {
  gap: '$s',
  padding: '$l',
  borderRadius: '$l',
  borderWidth: 1,
  variants: {
    tone: statusSurfaceVariants,
  },
});

const StatusBadge = styled(View, {
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: '$m',
  paddingVertical: '$xs',
  borderRadius: '$3xl',
  borderWidth: 1,
  variants: {
    tone: statusSurfaceVariants,
  },
});

const StatusText = styled(Text, {
  size: '$label/m',
  fontWeight: '600',
  variants: {
    tone: statusTextVariants,
  },
});

const ResultDetailText = styled(Text, {
  size: '$label/l',
  color: '$secondaryText',
  variants: {
    tone: {
      pending: {},
      running: {},
      pass: {},
      fail: {
        color: '$negativeActionText',
      },
    },
  },
});
