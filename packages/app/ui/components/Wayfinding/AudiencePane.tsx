import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  readWorkspaceDescriptor,
  workspaceConversation,
} from '@tloncorp/shared/logic';
import { useGroup } from '@tloncorp/shared/store';
import { Button, Pressable, Text, useCopy } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';
import { Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, XStack, YStack, isWeb } from 'tamagui';

import { SplashParagraph, SplashTitle } from './splashPrimitives';
import { useGroupInviteLink } from './useGroupInviteLink';

const logger = createDevLogger('AudiencePane', false);

/**
 * Onboarding interstitial 2: who is this workspace for?
 *
 * Two real answers — one specific person you are going to text, or nobody yet —
 * so the primary action is a shareable link rather than a list to scan. A link
 * also needs no address-book permission, which is the onboarding step most
 * likely to be denied.
 *
 * The three reassurances are the product's actual differentiation and are
 * pinned by this task's AC #2, so they are body copy rather than a feature
 * list: someone reading this is deciding whether to put their household's
 * plans somewhere, and three bullet points with headings read like marketing.
 */
export const AUDIENCE_DIFFERENTIATION = {
  privateAccess:
    'Only the people you invite here, and your agent, can see what happens in this space.',
  privateStore:
    'Everything it remembers — the history, the plans, the notes — lives in your own data store, not in a vendor’s.',
  modelIndependence:
    'Switching to a different AI model later changes who does the work. It does not erase any of it.',
} as const;

export type AudienceInviteState = 'ready' | 'loading' | 'unavailable';

export function AudiencePane(props: {
  /** Whether a shareable workspace link exists yet. */
  inviteState: AudienceInviteState;
  onInvitePress: () => void;
  /** Continue without inviting anyone. */
  onContinueAlone: () => void;
  /** Into the existing address-book flow, for finding people already here. */
  onFindPeoplePress?: () => void;
  didCopyInvite?: boolean;
  isCompleting?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const {
    inviteState,
    onInvitePress,
    onContinueAlone,
    onFindPeoplePress,
    didCopyInvite,
    isCompleting,
  } = props;

  return (
    <View flex={1} paddingTop={insets.top} paddingBottom={insets.bottom}>
      <YStack flex={1} gap="$2xl" paddingTop="$2xl">
        <SplashTitle>
          Who is this <Text color="$positiveActionText">space for?</Text>
        </SplashTitle>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: 12, paddingHorizontal: 24 }}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <SplashParagraph marginHorizontal={0} marginBottom="$s">
            Bring in the person you share this with — a partner, a housemate,
            whoever else it is for. You can do it later instead.
          </SplashParagraph>
          <YStack gap="$m" marginBottom="$s">
            <SplashParagraph
              testID="audience-private-access"
              marginHorizontal={0}
              marginBottom={0}
            >
              {AUDIENCE_DIFFERENTIATION.privateAccess}
            </SplashParagraph>
            <SplashParagraph
              testID="audience-private-store"
              marginHorizontal={0}
              marginBottom={0}
            >
              {AUDIENCE_DIFFERENTIATION.privateStore}
            </SplashParagraph>
            <SplashParagraph
              testID="audience-model-independence"
              marginHorizontal={0}
              marginBottom={0}
            >
              {AUDIENCE_DIFFERENTIATION.modelIndependence}
            </SplashParagraph>
          </YStack>
        </ScrollView>
      </YStack>
      <XStack marginHorizontal="$xl" marginTop="$xl">
        <Button
          data-testid="audience-invite"
          testID="audience-invite"
          onPress={onInvitePress}
          // 'loading' is a real state worth naming: the link comes from the
          // invite service and the workspace it points at was created moments
          // ago. 'unavailable' keeps the button pressable — it falls back to
          // the address book rather than dead-ending.
          label={
            didCopyInvite
              ? 'Link copied'
              : inviteState === 'loading'
                ? 'Preparing invite…'
                : 'Invite someone'
          }
          preset="hero"
          shadow
          flex={1}
          disabled={inviteState === 'loading' || !!isCompleting}
        />
      </XStack>
      {/* Text links rather than buttons, matching PurposePane: both are
          secondary paths, and button parity would read as three equally good
          answers to a question that really has one. */}
      {onFindPeoplePress ? (
        <Pressable
          testID="audience-find-people"
          onPress={onFindPeoplePress}
          disabled={!!isCompleting}
        >
          <Text
            size="$label/m"
            color="$secondaryText"
            textAlign="center"
            paddingTop="$l"
          >
            Find people you already know
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        testID="audience-continue-alone"
        onPress={onContinueAlone}
        disabled={!!isCompleting}
      >
        <Text
          size="$label/m"
          color="$secondaryText"
          textAlign="center"
          paddingVertical="$l"
        >
          I’ll do this later
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * `AudiencePane` wired to the workspace onboarding provisioned (TASK-16).
 *
 * Kept separate from the pane so the pane stays a pure function of its props
 * and can be tested without a ship, a group row, or the invite service.
 *
 * Records the landing handoff before completing, rather than navigating: the
 * workspace channel was created by a ship-side install moments ago and the
 * local row arrives with sync, so the navigation has to wait for it. See
 * `useWorkspaceLanding`.
 */
export function WorkspaceAudiencePane(props: {
  onCompleted: () => void;
  onFindPeoplePress?: () => void;
  isCompleting?: boolean;
}) {
  const provisioning = db.workspaceProvisioning.useValue();
  const groupId = provisioning?.groupId ?? undefined;
  const { data: group } = useGroup({ id: groupId });
  const conversation = useMemo(
    () => workspaceConversation(readWorkspaceDescriptor(group)),
    [group]
  );

  const { inviteUrl, state } = useGroupInviteLink({
    enabled: !!groupId,
    groupId,
  });
  const { doCopy, didCopy } = useCopy(inviteUrl ?? '');

  // Recorded on *any* exit from this pane, not just completion: the
  // address-book detour also ends in `handleSplashCompleted`, and a user who
  // takes it should still land in their workspace rather than on the chat list.
  const recordLanding = useCallback(async () => {
    // The conversation may not be known yet — a fast user can finish this
    // pane before the group row (whose blob names it) has synced. Record the
    // handoff anyway with what we have; the consumer resolves the channel
    // from the group once it lands. Only a missing groupId (provisioning
    // never started, or failed before writing state) skips the handoff and
    // leaves the user on the chat list, which is a working app.
    if (groupId) {
      try {
        await db.workspaceLanding.setValue({
          groupId,
          channelId: conversation ?? null,
        });
      } catch (error) {
        logger.trackError('Failed to record the workspace landing', { error });
      }
    }
  }, [conversation, groupId]);

  const complete = useCallback(async () => {
    await recordLanding();
    props.onCompleted();
  }, [props, recordLanding]);

  const handleFindPeople = useCallback(async () => {
    await recordLanding();
    props.onFindPeoplePress?.();
  }, [props, recordLanding]);

  const handleInvitePress = useCallback(async () => {
    if (inviteUrl) {
      try {
        if (isWeb) {
          if (typeof navigator.share === 'function') {
            await navigator.share({ url: inviteUrl });
          } else {
            await doCopy();
          }
        } else {
          await Share.share({ message: inviteUrl });
        }
      } catch (error) {
        logger.trackError('Failed to share the workspace invite', { error });
      }
    }
    await complete();
  }, [complete, doCopy, inviteUrl]);

  return (
    <AudiencePane
      inviteState={state}
      onInvitePress={handleInvitePress}
      onContinueAlone={complete}
      onFindPeoplePress={props.onFindPeoplePress ? handleFindPeople : undefined}
      didCopyInvite={didCopy}
      isCompleting={props.isCompleting}
    />
  );
}
