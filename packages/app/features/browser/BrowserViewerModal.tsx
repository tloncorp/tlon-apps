import { browserCardKey } from './browserCardKey';
import { createDevLogger } from '@tloncorp/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useWindowDimensions, type KeyDownEvent } from 'react-native';
import { Button, Icon, Pressable, Text } from '@tloncorp/ui';
import { Dialog, Spinner, VisuallyHidden, YStack } from 'tamagui';

import type { BrowserViewerModalProps } from './BrowserViewerModal.types';
import { BrowserVaultRequestError } from '@tloncorp/api/client/browserVault';
import {
  authorizeBrowserViewer,
  trustedBrowserViewerUrl,
} from './browserCredentialHandoff';

import {
  browserPreviewCache,
  isBrowserEnded,
  rememberBrowserPreview,
} from './browserPreviewCache';

const logger = createDevLogger('BrowserViewerModal', false);

export function BrowserViewerModal({
  viewerUrl,
  sourceViewerUrl = viewerUrl,
  onClose,
}: BrowserViewerModalProps) {
  const { width, height } = useWindowDimensions();
  const [url, setUrl] = useState(() => trustedBrowserViewerUrl(viewerUrl));
  const retryRequest = useRef<AbortController | null>(null);
  useEffect(() => () => retryRequest.current?.abort(), []);
  const cache = browserPreviewCache.useValue();
  const cachedStatus = cache?.[browserCardKey(sourceViewerUrl)]?.preview.status;
  const [failure, setFailure] = useState<'ended' | 'expired' | 'unavailable'>();
  const ended = isBrowserEnded(cachedStatus) || isBrowserEnded(failure);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closeSupported = useRef(false);
  const closePending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState(false);
  const origin = new URL(url).origin;
  const closeFailed = useCallback(() => {
    closePending.current = null;
    setClosing(false);
    setCloseError(true);
    logger.trackError('Browser viewer handback failed');
  }, []);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        event.source !== frame.current?.contentWindow ||
        event.origin !== origin
      )
        return;
      if (event.data?.type === 'tlon.browser.unavailable') {
        const status = event.data.status;
        const result =
          status === 404 || status === 410 ? 'ended' : 'unavailable';
        closeSupported.current = false;
        if (closePending.current !== null) {
          clearTimeout(closePending.current);
          closePending.current = null;
          setClosing(false);
          onCloseRef.current();
        }
        setFailure(result);
        setLoading(false);
        void rememberBrowserPreview(sourceViewerUrl, { status: result });
      } else if (event.data?.type === 'tlon.browser.ready') {
        closeSupported.current = event.data.closeSupported === true;
      } else if (
        event.data?.type === 'tlon.browser.closed' &&
        closePending.current !== null
      ) {
        clearTimeout(closePending.current);
        if (event.data.ok === true) {
          closePending.current = null;
          onCloseRef.current();
        } else closeFailed();
      }
    };
    window.addEventListener('message', receive);
    return () => {
      window.removeEventListener('message', receive);
      if (closePending.current !== null) clearTimeout(closePending.current);
    };
  }, [closeFailed, origin, sourceViewerUrl]);
  const close = useCallback(() => {
    if (closePending.current !== null) return;
    // Older viewers release through their socket/pagehide cleanup on unmount.
    if (!closeSupported.current || !frame.current?.contentWindow) {
      onCloseRef.current();
      return;
    }
    setClosing(true);
    setCloseError(false);
    closePending.current = setTimeout(closeFailed, 10000);
    frame.current?.contentWindow?.postMessage(
      { type: 'tlon.browser.close' },
      origin
    );
  }, [closeFailed, origin]);
  const retry = async () => {
    if (retryRequest.current) return;
    const controller = new AbortController();
    retryRequest.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    setLoading(true);
    try {
      const next = await authorizeBrowserViewer(
        sourceViewerUrl,
        controller.signal
      );
      if (controller.signal.aborted) return;
      setUrl(trustedBrowserViewerUrl(next));
      setFailure(undefined);
      setAttempt((value) => value + 1);
    } catch (error) {
      const status =
        error instanceof BrowserVaultRequestError ? error.status : undefined;
      const result =
        status === 401
          ? 'expired'
          : status === 404 || status === 410
            ? 'ended'
            : 'unavailable';
      setFailure(result);
      setLoading(false);
      void rememberBrowserPreview(sourceViewerUrl, { status: result });
      logger.trackError('Browser viewer could not reconnect');
    } finally {
      clearTimeout(timeout);
      retryRequest.current = null;
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay backgroundColor="$darkOverlay" opacity={0.5} />
        <Dialog.Content
          width={width * 0.95}
          maxWidth={1440}
          height={height * 0.9}
          padding={0}
          borderRadius="$2xl"
          borderWidth={1}
          borderColor="$border"
          overflow="hidden"
        >
          <VisuallyHidden>
            <Dialog.Title>Live browser</Dialog.Title>
          </VisuallyHidden>
          <Pressable
            onPress={close}
            disabled={closing}
            role="button"
            tabIndex={0}
            onKeyDown={(event: KeyDownEvent & { key?: string }) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                close();
              }
            }}
            position="absolute"
            top="$m"
            right="$m"
            zIndex={1}
            backgroundColor="$background"
            borderWidth={0}
            borderRadius="$2xl"
            aria-label={
              closing ? 'Handing back browser control' : 'Close browser'
            }
            padding="$m"
          >
            <Icon type="Close" />
          </Pressable>
          {closeError && (
            <Text
              position="absolute"
              bottom="$4xl"
              alignSelf="center"
              zIndex={1}
              backgroundColor="$background"
              padding="$m"
              role="alert"
            >
              Could not hand back control. Try closing again.
            </Text>
          )}
          {failure || ended ? (
            <YStack
              flex={1}
              alignItems="center"
              justifyContent="center"
              gap="$l"
              padding="$2xl"
            >
              <Icon type="InfoCircle" color="$secondaryText" />
              <Text size="$label/2xl">
                {ended ? 'Browser session ended' : 'Browser unavailable'}
              </Text>
              <Text color="$secondaryText" textAlign="center">
                {ended
                  ? 'Ask your bot to open a new browser.'
                  : 'We couldn’t connect to this browser. Please try again.'}
              </Text>
              {!ended && (
                <Button label="Try again" disabled={loading} onPress={retry} />
              )}
            </YStack>
          ) : (
            <>
              {loading && (
                <YStack
                  position="absolute"
                  inset={0}
                  alignItems="center"
                  justifyContent="center"
                  pointerEvents="none"
                >
                  <Spinner
                    size="small"
                    color="$secondaryText"
                    accessibilityLabel="Loading browser"
                  />
                </YStack>
              )}
              <iframe
                key={attempt}
                onError={() => {
                  setFailure('unavailable');
                  setLoading(false);
                }}
                ref={frame}
                onLoad={() => {
                  setLoading(false);
                  closeSupported.current = false;
                  frame.current?.contentWindow?.postMessage(
                    { type: 'tlon.browser.status' },
                    origin
                  );
                }}
                title="Live browser"
                src={url}
                allow="autoplay; clipboard-read; clipboard-write"
                referrerPolicy="no-referrer"
                style={{ flex: 1, minHeight: 0, width: '100%', border: 0 }}
              />
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
