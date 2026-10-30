import { browserCardKey } from './browserCardKey';
import { createDevLogger } from '@tloncorp/shared';
import { Pressable, Text } from '@tloncorp/ui';
import { type ComponentRef, useEffect, useRef } from 'react';
import { Image, View } from 'react-native';
import { Spinner, YStack } from 'tamagui';

import { useOptionalBrowserCredentialHandoff } from './BrowserCredentialHandoffContext';
import {
  BrowserPreviewAuthorizationError,
  browserPreviewEndpoint,
  fetchBrowserPreview,
  type BrowserPreview,
} from './browserPreview';
import { useBrowserPreviewVisible } from './useBrowserPreviewVisible';

import {
  browserPreviewCache,
  isBrowserEnded,
  rememberBrowserPreview,
} from './browserPreviewCache';

const logger = createDevLogger('BrowserSessionPreview', false);
const terminal = new Set(['ended', 'expired', 'unsupported']);
type Snapshot = Extract<BrowserPreview, { status: 'ready' }>;

export function BrowserSessionPreview({
  viewerUrl,
  onOpen,
}: {
  viewerUrl: string;
  onOpen: () => void;
}) {
  const handoff = useOptionalBrowserCredentialHandoff();
  const ref = useRef<ComponentRef<typeof View>>(null);
  const visible = useBrowserPreviewVisible(ref, !handoff?.viewerOpen);
  const { value: cache, isLoading } = browserPreviewCache.useStorageItem();
  const entry = cache?.[browserCardKey(viewerUrl)];
  const preview = entry?.preview ?? { status: 'busy' as const };
  const snapshot = entry?.snapshot;
  const endpoint = useRef<{ viewerUrl: string; url: string } | undefined>(
    undefined
  );
  const failed = useRef(false);
  const stopped = terminal.has(preview.status);
  useEffect(() => {
    endpoint.current = undefined;
  }, [viewerUrl]);

  useEffect(() => {
    if (!visible || stopped || isLoading) return;
    let disposed = false;
    let finished = false;
    let controller: AbortController;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      let delay = 5000;
      try {
        if (endpoint.current?.viewerUrl !== viewerUrl) {
          const url = await browserPreviewEndpoint(
            viewerUrl,
            controller.signal
          );
          if (disposed) return;
          if (typeof url !== 'string') {
            finished = true;
            await rememberBrowserPreview(viewerUrl, url);
            return;
          }
          endpoint.current = { viewerUrl, url };
        }
        const result = await fetchBrowserPreview(
          endpoint.current.url,
          controller.signal
        );
        if (disposed) return;
        finished = terminal.has(result.status);
        await rememberBrowserPreview(viewerUrl, result);
        failed.current = false;
      } catch (error) {
        if (error instanceof BrowserPreviewAuthorizationError)
          endpoint.current = undefined;
        if (disposed) return;
        await rememberBrowserPreview(viewerUrl, { status: 'unavailable' });
        if (!failed.current)
          logger.trackError('Browser preview could not load');
        failed.current = true;
        delay = 30000;
      } finally {
        clearTimeout(timeout);
        if (!disposed && !finished) timer = setTimeout(refresh, delay);
      }
    };
    // Remounts reuse the image immediately and honor the existing refresh interval.
    const remaining = Math.max(
      0,
      5000 - (Date.now() - (entry?.checkedAt ?? 0))
    );
    if (remaining) timer = setTimeout(refresh, remaining);
    else void refresh();
    return () => {
      disposed = true;
      controller?.abort();
      clearTimeout(timer);
    };
  }, [visible, viewerUrl, stopped, isLoading]);

  if (preview.status === 'unsupported') return null;
  return (
    <View ref={ref} collapsable={false}>
      <BrowserPreviewContent
        preview={preview}
        snapshot={snapshot}
        onOpen={onOpen}
      />
    </View>
  );
}

export function BrowserPreviewContent({
  preview,
  snapshot,
  onOpen,
}: {
  preview: BrowserPreview;
  snapshot?: Snapshot;
  onOpen: () => void;
}) {
  const label =
    preview.status === 'protected'
      ? 'Entering credentials'
      : preview.status === 'ended'
        ? 'Session ended'
        : preview.status === 'expired'
          ? 'Browser link expired'
          : preview.status === 'unavailable'
            ? 'Preview temporarily unavailable'
            : snapshot
              ? snapshot.hostname
              : '';
  return (
    <YStack gap="$s" width="100%" testID="BrowserSessionPreview">
      <Pressable
        onPress={isBrowserEnded(preview.status) ? undefined : onOpen}
        disabled={isBrowserEnded(preview.status)}
        accessibilityRole="button"
        accessibilityLabel="Open browser preview"
      >
        <YStack
          aspectRatio={1.6}
          width="100%"
          borderRadius="$s"
          overflow="hidden"
          backgroundColor="$background"
          alignItems="center"
          justifyContent="center"
        >
          {snapshot &&
          preview.status !== 'protected' &&
          !isBrowserEnded(preview.status) ? (
            <Image
              source={{ uri: snapshot.image }}
              resizeMode="contain"
              style={{ width: '100%', height: '100%' }}
              accessibilityLabel={snapshot.title || 'Browser page preview'}
            />
          ) : preview.status === 'busy' ? (
            <Spinner
              size="small"
              color="$secondaryText"
              accessibilityLabel="Loading browser preview"
            />
          ) : (
            <Text color="$secondaryText" textAlign="center" padding="$m">
              {label}
            </Text>
          )}
        </YStack>
      </Pressable>
    </YStack>
  );
}

export function BrowserSessionAction({
  viewerUrl,
  children,
}: {
  viewerUrl: string;
  children: React.ReactNode;
}) {
  const cache = browserPreviewCache.useValue();
  return isBrowserEnded(cache?.[browserCardKey(viewerUrl)]?.preview.status)
    ? null
    : children;
}
