import * as db from '@tloncorp/shared/db';
import {
  A2UI,
  type MiniAppJSONValue,
  type MiniAppPostBlob,
  appendToPostBlob,
  getMiniAppActionBlobs,
} from '@tloncorp/shared/logic';
import { sendFinalizedPost, useThreadPosts } from '@tloncorp/shared/store';
import { Text } from '@tloncorp/ui';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { XStack, YStack } from 'tamagui';

import { useCurrentUserId } from '../../contexts/appDataContext';
import { A2UIBlock } from '../PostContent/A2UIBlock';
import { ContentContext } from '../PostContent/contentUtils';
import { useDraftInputContext } from '../draftInputs/shared';
import { MiniAppScene } from './MiniAppScene';
import {
  MINI_APP_LIMITS,
  type MiniAppPendingAction,
  type MiniAppReplayResult,
  type MiniAppSocialContext,
  replayMiniApp,
} from './miniAppRuntime';

function createActionId(): string {
  const randomId =
    globalThis.crypto && 'randomUUID' in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  return `mini-${randomId}`;
}

export function MiniAppPost({
  fallback,
  miniApp,
  post,
}: {
  fallback: React.ReactNode;
  miniApp: MiniAppPostBlob;
  post: db.Post;
}) {
  const currentUserId = useCurrentUserId();
  const draftInputContext = useDraftInputContext();
  const threadPosts = useThreadPosts({
    postId: post.id,
    authorId: post.authorId,
    channelId: post.channelId,
  });
  const [runResult, setRunResult] = useState<MiniAppReplayResult | null>(null);
  const [lastGoodResult, setLastGoodResult] = useState<Extract<
    MiniAppReplayResult,
    { ok: true }
  > | null>(null);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const [optimisticActions, setOptimisticActions] = useState<
    MiniAppPendingAction[]
  >([]);
  const miniAppKey = `${miniApp.appId}:${miniApp.bundleSha256}`;
  const miniAppKeyRef = useRef(miniAppKey);

  const replies = threadPosts.data;
  const canSubmitActions = useMemo(() => {
    return !!draftInputContext && draftInputContext.canStartDraft !== false;
  }, [draftInputContext]);

  useEffect(() => {
    if (miniAppKeyRef.current === miniAppKey) {
      return;
    }

    miniAppKeyRef.current = miniAppKey;
    setRunResult(null);
    setLastGoodResult(null);
    setReplayError(null);
    setOptimisticActions([]);
  }, [miniAppKey]);

  const socialContext = useMemo((): MiniAppSocialContext => {
    const participants = Array.from(
      new Set(
        [
          post.authorId,
          currentUserId,
          ...(replies?.map((reply) => reply.authorId) ?? []),
        ].filter(
          (participant): participant is string =>
            typeof participant === 'string'
        )
      )
    );
    const profilesByShip: MiniAppSocialContext['profilesByShip'] = {};
    for (const participantPost of [post, ...(replies ?? [])]) {
      const author = participantPost.author as
        | {
            avatar?: string | null;
            customAvatarImage?: string | null;
            customNickname?: string | null;
            nickname?: string | null;
            peerAvatarImage?: string | null;
            peerNickname?: string | null;
          }
        | undefined;
      profilesByShip[participantPost.authorId] = {
        nickname:
          author?.nickname ??
          author?.customNickname ??
          author?.peerNickname ??
          undefined,
        avatar:
          author?.avatar ??
          author?.customAvatarImage ??
          author?.peerAvatarImage ??
          undefined,
      };
    }

    return {
      appId: miniApp.appId,
      title: miniApp.title,
      viewer: currentUserId ?? null,
      participants,
      profilesByShip,
      channel: {
        id: post.channelId,
        type: draftInputContext?.channel.type,
        groupId: draftInputContext?.channel.groupId,
      },
      host: post.authorId,
      capabilities: {
        canWrite: canSubmitActions,
      },
      limits: MINI_APP_LIMITS,
    };
  }, [
    canSubmitActions,
    currentUserId,
    draftInputContext?.channel.groupId,
    draftInputContext?.channel.type,
    miniApp.appId,
    miniApp.title,
    post,
    replies,
  ]);

  const confirmedMiniAppActionIds = useMemo(() => {
    const actionIds = new Set<string>();
    for (const reply of replies ?? []) {
      for (const action of getMiniAppActionBlobs(reply.blob)) {
        if (action.appId === miniApp.appId) {
          actionIds.add(action.actionId);
        }
      }
    }

    return actionIds;
  }, [miniApp.appId, replies]);

  useEffect(() => {
    if (confirmedMiniAppActionIds.size === 0) {
      return;
    }

    setOptimisticActions((current) => {
      const filtered = current.filter(
        (action) => !confirmedMiniAppActionIds.has(action.actionId)
      );
      return filtered.length === current.length ? current : filtered;
    });
  }, [confirmedMiniAppActionIds]);

  useEffect(() => {
    let cancelled = false;
    setIsReplaying(true);

    replayMiniApp({
      context: socialContext,
      optimisticActions,
      miniApp,
      replies,
    })
      .then(
        (result) => {
          if (!cancelled) {
            setRunResult(result);
            if (result.ok) {
              setLastGoodResult(result);
              setReplayError(null);
            } else {
              setReplayError(result.error);
            }
          }
        },
        () => {
          if (!cancelled) {
            const error = 'Mini app failed to render.';
            setRunResult({ ok: false, error });
            setReplayError(error);
          }
        }
      )
      .finally(() => {
        if (!cancelled) {
          setIsReplaying(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [miniApp, optimisticActions, replies, socialContext]);

  const submitMiniAppAction = useCallback(
    async (actionPayload: MiniAppJSONValue) => {
      if (!canSubmitActions) {
        return;
      }

      const actionId = createActionId();
      const createdAt = Date.now();
      const blob = appendToPostBlob(undefined, {
        type: 'tlon-mini-app-action',
        version: 1,
        appId: miniApp.appId,
        actionId,
        action: actionPayload,
        createdAt,
      });

      setOptimisticActions((current) => [
        ...current,
        {
          action: actionPayload,
          actionId,
          actor: currentUserId ?? post.authorId,
          postId: `optimistic:${actionId}`,
        },
      ]);

      try {
        await sendFinalizedPost({
          channelId: post.channelId,
          content: [],
          blob,
          replyToPostId: post.id,
        });
      } catch (error) {
        setOptimisticActions((current) =>
          current.filter((action) => action.actionId !== actionId)
        );
        throw error;
      }
    },
    [
      canSubmitActions,
      currentUserId,
      miniApp.appId,
      post.authorId,
      post.channelId,
      post.id,
    ]
  );

  const handleA2UIAction = useCallback(
    async (action: A2UI.Button['action']) => {
      if (
        action.event.name !== A2UI.action.miniAppAction ||
        action.event.data.appId !== miniApp.appId
      ) {
        return;
      }

      await submitMiniAppAction(action.event.data.action);
    },
    [miniApp.appId, submitMiniAppAction]
  );

  const visibleResult = runResult?.ok ? runResult : lastGoodResult;

  if (!runResult && !visibleResult) {
    return (
      <YStack gap="$s" maxWidth={560}>
        <YStack
          borderWidth={1}
          borderColor="$border"
          borderRadius="$m"
          padding="$m"
          backgroundColor="$secondaryBackground"
        >
          <Text color="$secondaryText" size="$label/m">
            Loading mini app...
          </Text>
        </YStack>
      </YStack>
    );
  }

  if (!visibleResult) {
    return (
      <YStack gap="$s" maxWidth={560}>
        {fallback}
        <YStack
          borderWidth={1}
          borderColor="$border"
          borderRadius="$m"
          padding="$m"
          backgroundColor="$secondaryBackground"
        >
          <Text color="$negativeActionText" size="$label/m">
            {replayError || 'Mini app failed to render.'}
          </Text>
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack gap="$m" maxWidth={560}>
      {(visibleResult.render.summary || visibleResult.render.badge) && (
        <XStack gap="$s" alignItems="center" minHeight={24}>
          {visibleResult.render.badge ? (
            <Text size="$label/s" color="$secondaryText" numberOfLines={1}>
              {typeof visibleResult.render.badge === 'string'
                ? visibleResult.render.badge
                : visibleResult.render.badge.text}
            </Text>
          ) : null}
          {visibleResult.render.summary ? (
            <Text
              size="$label/m"
              color="$secondaryText"
              flex={1}
              minWidth={0}
              numberOfLines={1}
            >
              {visibleResult.render.summary}
            </Text>
          ) : null}
          <Text
            size="$label/s"
            color="$secondaryText"
            opacity={
              isReplaying || visibleResult.optimisticActionCount > 0 ? 1 : 0
            }
            numberOfLines={1}
          >
            Syncing...
          </Text>
        </XStack>
      )}
      {visibleResult.render.visual ? (
        <YStack alignSelf="flex-start" position="relative">
          <MiniAppScene
            scene={visibleResult.render.visual}
            disabled={!canSubmitActions}
            onAction={submitMiniAppAction}
            socialContext={socialContext}
          />
          {replayError ? (
            <XStack
              position="absolute"
              top="$s"
              right="$s"
              backgroundColor="$secondaryBackground"
              borderColor="$negativeActionText"
              borderWidth={1}
              borderRadius="$s"
              paddingHorizontal="$s"
              paddingVertical="$2xs"
            >
              <Text
                color="$negativeActionText"
                size="$label/s"
                numberOfLines={1}
              >
                Mini app render issue
              </Text>
            </XStack>
          ) : null}
        </YStack>
      ) : null}
      {visibleResult.render.controls ? (
        <ContentContext.Provider
          onA2UIAction={canSubmitActions ? handleA2UIAction : undefined}
        >
          <A2UIBlock
            block={{ type: 'a2ui', a2ui: visibleResult.render.controls }}
          />
        </ContentContext.Provider>
      ) : null}
    </YStack>
  );
}
