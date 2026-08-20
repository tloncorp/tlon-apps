// tamagui-ignore
import {
  AnalyticsEvent,
  AnalyticsSeverity,
  createDevLogger,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Button, LoadingSpinner, Text } from '@tloncorp/ui';
import React, {
  ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FlatList, Image, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  YStack,
  ZStack,
  getTokenValue,
  isWeb,
  useThemeName,
} from 'tamagui';

import { useContactDiscovery } from '../../../hooks/useContactDiscovery';
import { useContactPermissions } from '../../../hooks/useContactPermissions';
import { useIsDarkMode } from '../../../hooks/useDarkMode';
import {
  InviteSystemContactsFn,
  useInviteSystemContactHandler,
} from '../../../hooks/useInviteSystemContactHandler';
import { useSystemContactSearch } from '../../hooks/systemContactSorters';
import { PersonalInviteButton } from '../PersonalInviteButton';
import { ScreenHeader } from '../ScreenHeader';
import { SearchBar } from '../SearchBar';
import { SystemContactListItem } from '../listItems';
import { WorkspaceAudiencePane } from './AudiencePane';
import { PurposePane } from './PurposePane';
import { SplashParagraph, SplashTitle } from './splashPrimitives';
import { defaultStarterOptionId } from './starterOptions';

/**
 * Splash sequence panes.
 *
 * Bot-enabled flow:
 *   Welcome → Purpose → TlonBot → BotName → BotAvatar → BotProvider
 *     → (BotApiKey or BotSubscriptionAuth) → BotModel → Audience
 *
 * Standard flow:
 *   Welcome → Purpose → [bot config] → Audience
 *
 * Purpose and Audience are onboarding's two interstitials. The groups
 * explainers that used to sit between them (Group → Channels → Privacy) are
 * gone: they taught the groups product — "everything happens in a channel",
 * group privacy levels — which the workspace model contradicts, and they
 * created nothing.
 *
 * The bot panes remain because they carry real hosting configuration and no
 * settings surface exists to host it yet.
 */
enum SplashPane {
  // Interstitial 1: what should this space do?
  Purpose = 'Purpose',
  // Interstitial 2: who is this for? Last, so nothing intervenes between it
  // and the workspace conversation.
  Audience = 'Audience',
  // The address-book detour, reached from interstitial 2 rather than a step.
  Invite = 'Invite',
}

function SplashSequenceComponent(props: {
  onCompleted: () => void;
  inviteSystemContacts?: InviteSystemContactsFn;
}) {
  const [currentPane, setCurrentPane] = React.useState(SplashPane.Purpose);
  const [starterKitId, setStarterKitId] = React.useState<string | undefined>(
    defaultStarterOptionId
  );
  const [finishingSplash, setFinishingSplash] = React.useState(false);
  const isMountedRef = React.useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleStarterSelected = useCallback(
    async (selectedId: string | undefined) => {
      // Persisted rather than held in component state: signup mode has no
      // pane-level resume, so this is the one piece of the answer that
      // survives the app being killed mid-sequence. Interstitial 2 and
      // background provisioning both read it from here.
      await db.signupData.setValue((current) => ({
        ...current,
        starterKitId: selectedId,
      }));

      // Deliberately not awaited: provisioning takes a round trip to the ship
      // and back, and nothing about the next pane depends on it. Progress lives
      // in a durable storage item, so a slow or failed install is discovered by
      // whoever reads that — never by holding up a transition here.
      store.startWorkspaceProvisioning(selectedId);
      setCurrentPane(SplashPane.Audience);
    },
    []
  );

  const handleSplashCompleted = useCallback(async () => {
    if (finishingSplash) {
      return;
    }
    setFinishingSplash(true);
    props.onCompleted();
    try {
      await store.completeWayfindingSplash();
    } catch (error) {
      logger.trackError('Failed to complete wayfinding splash', { error });
    } finally {
      if (isMountedRef.current) {
        setFinishingSplash(false);
      }
    }
  }, [finishingSplash, props]);

  return (
    <View flex={1}>
      {currentPane === SplashPane.Purpose && (
        <PurposePane
          selectedId={starterKitId}
          onSelect={setStarterKitId}
          onActionPress={() => handleStarterSelected(starterKitId)}
          onSkipPress={() => handleStarterSelected(undefined)}
        />
      )}

      {currentPane === SplashPane.Audience && (
        <WorkspaceAudiencePane
          onCompleted={handleSplashCompleted}
          onFindPeoplePress={() => setCurrentPane(SplashPane.Invite)}
          isCompleting={finishingSplash}
        />
      )}

      {currentPane === SplashPane.Invite && (
        <InvitePane
          onActionPress={handleSplashCompleted}
          inviteSystemContacts={props.inviteSystemContacts}
          isCompleting={finishingSplash}
        />
      )}
    </View>
  );
}

export const SplashSequence = React.memo(SplashSequenceComponent);

const logger = createDevLogger('SplashSequence', true);

const INVITE_EXPLANATION_TEXT = "You'll receive a DM when they join.";

export function InviteContactsContent(props: {
  onComplete: () => void;
  systemContacts: db.SystemContact[];
  inviteSystemContacts?: InviteSystemContactsFn;
  completing?: boolean;
  isDiscovering?: boolean;
  discoveredMatches?: db.SystemContact[];
}) {
  const inviteLink = db.personalInviteLink.useValue();
  const handleInviteContact = useInviteSystemContactHandler(
    props.inviteSystemContacts,
    inviteLink
  );
  const isReady = !!inviteLink;

  const matchedIds = useMemo(
    () => new Set((props.discoveredMatches ?? []).map((c) => c.id)),
    [props.discoveredMatches]
  );
  const invitableContacts = useMemo(
    () => props.systemContacts.filter((c) => !matchedIds.has(c.id)),
    [props.systemContacts, matchedIds]
  );

  const hasContacts = invitableContacts.length > 0;
  const hasMatches = (props.discoveredMatches?.length ?? 0) > 0;

  const { displayContacts, handleSearch } =
    useSystemContactSearch(invitableContacts);

  return (
    <YStack flex={1}>
      <ScreenHeader
        title="Invite your friends"
        rightControls={
          <ScreenHeader.TextButton
            testID="finish-invites"
            disabled={props.completing}
            onPress={props.completing ? undefined : props.onComplete}
          >
            {props.completing ? 'Finishing...' : 'Next'}
          </ScreenHeader.TextButton>
        }
      />
      {!hasContacts && !hasMatches && !props.isDiscovering ? (
        <ShareInviteLinkEmptyState />
      ) : !isReady ? (
        <LoadingState />
      ) : (
        <>
          <SplashParagraph marginTop="$l" marginBottom="$xl">
            {INVITE_EXPLANATION_TEXT}
          </SplashParagraph>
          <MatchedContactsSection
            isDiscovering={!!props.isDiscovering}
            matches={props.discoveredMatches ?? []}
          />
          {hasContacts && (
            <SearchBar
              paddingHorizontal="$xl"
              flexGrow={0}
              debounceTime={100}
              onChangeQuery={handleSearch}
              placeholder="Search contacts"
              inputProps={{
                spellCheck: false,
                autoCapitalize: 'none',
                autoComplete: 'off',
                flex: 1,
              }}
            />
          )}
          <FlatList
            data={displayContacts}
            keyExtractor={(item) => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={{
              padding: getTokenValue('$l', 'size'),
              paddingBottom: getTokenValue('$4xl', 'size'),
            }}
            renderItem={({ item: contact }) => (
              <SystemContactListItem
                systemContact={contact}
                onPress={() => handleInviteContact(contact)}
                showInvitedStatus
              />
            )}
          />
        </>
      )}
    </YStack>
  );
}

function MatchedContactsSection({
  isDiscovering,
  matches,
}: {
  isDiscovering: boolean;
  matches: db.SystemContact[];
}) {
  if (!isDiscovering && matches.length === 0) {
    return null;
  }
  return (
    <YStack paddingHorizontal="$xl" marginBottom="$l" gap="$s">
      {isDiscovering ? (
        <View flexDirection="row" alignItems="center" gap="$s">
          <LoadingSpinner size="small" />
          <Text size="$label/m" color="$secondaryText">
            Finding your contacts on Tlon…
          </Text>
        </View>
      ) : (
        <Text size="$label/m" color="$secondaryText">
          {matches.length === 1
            ? '1 of your contacts is on Tlon'
            : `${matches.length} of your contacts are on Tlon`}
        </Text>
      )}
      {matches.map((contact) => (
        <SystemContactListItem
          key={contact.id}
          systemContact={contact}
          iconProps={{ icon: 'Checkmark' }}
          endContent={
            <Text size="$label/s" color="$positiveActionText">
              On Tlon
            </Text>
          }
          showEndContent
        />
      ))}
    </YStack>
  );
}

function LoadingState() {
  const insets = useSafeAreaInsets();

  return (
    <YStack
      flex={1}
      paddingHorizontal="$xl"
      paddingBottom={insets.bottom + getTokenValue('$6xl', 'size')}
    >
      <SplashParagraph marginTop="$l">
        {INVITE_EXPLANATION_TEXT}
      </SplashParagraph>
      <YStack flex={1} justifyContent="center" alignItems="center" gap="$xl">
        <LoadingSpinner size="large" />
        <Text size="$body" color="$secondaryText">
          Preparing your invite link
        </Text>
      </YStack>
    </YStack>
  );
}

function ShareInviteLinkEmptyState() {
  const insets = useSafeAreaInsets();
  const themeName = useThemeName();
  const isDark = themeName === 'dark';

  const facesImage = isDark
    ? isWeb
      ? `./faces-dark.png`
      : require(`../../assets/raster/faces-dark.png`)
    : isWeb
      ? `./faces.png`
      : require(`../../assets/raster/faces.png`);

  return (
    <YStack
      flex={1}
      justifyContent="flex-start"
      alignItems="center"
      paddingHorizontal="$xl"
      paddingBottom={insets.bottom}
    >
      <YStack alignItems="center" gap="$3xl" width="100%" maxWidth={340}>
        <View paddingTop="$5xl" paddingBottom={'$2xl'}>
          <Image
            style={{ width: 200, height: 141 }}
            resizeMode="contain"
            source={facesImage}
          />
        </View>
        <SplashParagraph marginHorizontal={0}>
          {INVITE_EXPLANATION_TEXT}
        </SplashParagraph>
        <View width="100%">
          <PersonalInviteButton />
        </View>
      </YStack>
    </YStack>
  );
}

function ConnectContactBookContent(props: {
  onConnectContacts: () => void;
  onSkip: () => void;
  isProcessing: boolean;
  isCompleting?: boolean;
  forceShowConnect?: boolean;
}) {
  const insets = useSafeAreaInsets();

  const shouldShowConnectOption = props.forceShowConnect || !isWeb;

  const handleAction = shouldShowConnectOption
    ? props.onConnectContacts
    : props.onSkip;

  return (
    <View flex={1} paddingBottom={insets.bottom}>
      <InviteFriendsDisplay />
      <YStack flex={1} gap="$2xl" paddingTop="$2xl">
        <SplashTitle>
          Works best with{' '}
          <Text color="$positiveActionText">people you know.</Text>
        </SplashTitle>
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <SplashParagraph>
            When your friends join, they get their own private personal server
            too. Post together with peace of mind, for as long as your group
            exists.
          </SplashParagraph>
          {shouldShowConnectOption && (
            <SplashParagraph fontWeight="600" color="$primaryText">
              Your contacts are never uploaded — we only send anonymous, hashed
              identifiers to our server to match you with people you know.
            </SplashParagraph>
          )}
        </ScrollView>
        {props.isProcessing && !isWeb && (
          <YStack alignItems="center">
            <LoadingSpinner />
          </YStack>
        )}
      </YStack>
      <YStack paddingHorizontal="$xl" gap="$l">
        <Button
          data-testid="connect-contact-book"
          testID="connect-contact-book"
          onPress={handleAction}
          label={
            props.isCompleting
              ? 'Finishing...'
              : shouldShowConnectOption
                ? 'Connect contact book'
                : 'Finish'
          }
          preset="hero"
          shadow
          disabled={props.isProcessing || props.isCompleting}
        />
        {shouldShowConnectOption && (
          <Button
            data-testid="skip-contact-book"
            testID="skip-contact-book"
            onPress={props.onSkip}
            label="Skip"
            preset="secondary"
            backgroundColor="transparent"
            disabled={props.isProcessing || props.isCompleting}
          />
        )}
      </YStack>
    </View>
  );
}

export function InvitePane(props: {
  onActionPress: () => void;
  inviteSystemContacts?: InviteSystemContactsFn;
  isCompleting?: boolean;
  syncSystemContacts?: typeof store.syncSystemContacts;
  syncContactDiscovery?: typeof store.syncContactDiscovery;
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showInviteContacts, setShowInviteContacts] = useState(false);
  const [sysContacts, setSysContacts] = useState<db.SystemContact[]>([]);
  const {
    isDiscovering,
    discoveredMatches,
    runDiscovery,
    notifyPendingMatches,
  } = useContactDiscovery(props.syncContactDiscovery);
  const hasAutoProcessed = useRef(false);
  const perms = useContactPermissions();

  const advanceToInviteContacts = useCallback(() => {
    hasAutoProcessed.current = true;
    setSysContacts([]);
    setShowInviteContacts(true);
  }, []);

  const processContacts = useCallback(async () => {
    let syncedContacts: db.SystemContact[] = [];
    try {
      setIsProcessing(true);
      syncedContacts = await (
        props.syncSystemContacts ?? store.syncSystemContacts
      )();
      setSysContacts(syncedContacts);
      if (syncedContacts.length === 0) {
        logger.trackEvent(AnalyticsEvent.ActionContactBookSkipped, {
          reason: 'no_contacts_synced',
        });
      }
    } catch (err) {
      logger.trackError('Failed to sync system contacts', { error: err });
    } finally {
      setIsProcessing(false);
      setShowInviteContacts(true);
    }
    // Kick off lanyard discovery in the background once the invite pane
    // is visible. The user can advance before it completes — if they do,
    // handleActionPress tails the promise so the match notification
    // fires normally. If they stay and we surface matches here, we
    // suppress the notification to avoid double-announcing.
    if (syncedContacts.length > 0) {
      void runDiscovery(syncedContacts);
    }
  }, [runDiscovery, props.syncSystemContacts]);

  const handleActionPress = useCallback(() => {
    notifyPendingMatches();
    props.onActionPress();
  }, [props, notifyPendingMatches]);

  useEffect(() => {
    if (isWeb || perms.isLoading || hasAutoProcessed.current) {
      return;
    }

    if (perms.hasPermission) {
      hasAutoProcessed.current = true;
      processContacts();
      return;
    }

    if (perms.permissionDenied) {
      advanceToInviteContacts();
    }
  }, [
    advanceToInviteContacts,
    perms.hasPermission,
    perms.isLoading,
    perms.permissionDenied,
    processContacts,
  ]);

  const handleConnectContacts = async () => {
    try {
      if (perms.canAskPermission) {
        const status = await perms.requestPermissions();
        if (status === 'granted') {
          hasAutoProcessed.current = true;
          await processContacts();
          return;
        }

        if (status === 'denied') {
          advanceToInviteContacts();
        }
        return;
      }

      if (perms.hasPermission) {
        hasAutoProcessed.current = true;
        await processContacts();
        return;
      }

      if (perms.permissionDenied) {
        advanceToInviteContacts();
      }
    } catch (e) {
      logger.trackEvent(AnalyticsEvent.ErrorSystemContacts, {
        context: 'handleConnectContacts threw',
        error: e,
        severity: AnalyticsSeverity.Critical,
      });
    }
  };

  const handleSkip = () => {
    if (isWeb) {
      props.onActionPress();
      return;
    }
    logger.trackEvent(AnalyticsEvent.ActionContactBookSkipped);
    setShowInviteContacts(true);
  };

  if (showInviteContacts) {
    return (
      <InviteContactsContent
        onComplete={handleActionPress}
        systemContacts={sysContacts}
        inviteSystemContacts={props.inviteSystemContacts}
        completing={props.isCompleting}
        isDiscovering={isDiscovering}
        discoveredMatches={discoveredMatches}
      />
    );
  }

  return (
    <ConnectContactBookContent
      onConnectContacts={handleConnectContacts}
      onSkip={handleSkip}
      isProcessing={isProcessing}
      isCompleting={props.isCompleting}
    />
  );
}

const InviteFriendsDisplay = () => {
  const isDark = useIsDarkMode();

  return (
    <View marginBottom="$2xl" height={410}>
      <ZStack flex={1}>
        <View position="relative" top={-80} right={isWeb ? 120 : 0}>
          <Image
            style={{ width: '100%', height: 340 }}
            resizeMode="contain"
            source={
              isWeb
                ? isDark
                  ? `./tlon-ids-dark.png`
                  : `./tlon-ids.png`
                : isDark
                  ? require(`../../assets/raster/tlon-ids-dark.png`)
                  : require(`../../assets/raster/tlon-ids.png`)
            }
          />
        </View>
        <InviteCard position="absolute" bottom={0} right={30} />
      </ZStack>
    </View>
  );
};

const InviteCard = (props: ComponentProps<typeof View>) => {
  return (
    <View
      width={300}
      height={200}
      borderRadius="$xl"
      overflow="hidden"
      {...props}
    >
      <ZStack flex={1}>
        <Image
          style={{ width: 300, height: 200 }}
          resizeMode="cover"
          source={
            isWeb
              ? `./plant-light.png`
              : require(`../../assets/raster/plant-light.png`)
          }
        />
        <ZStack width="100%" height={50} position="absolute" bottom={0}>
          <View flex={1} backgroundColor="$black" opacity={0.4} />
          <YStack flex={1} justifyContent="center" marginLeft="$l" gap="$m">
            <Text size="$label/s" color="$white" fontWeight="500">
              Tlon Messenger: kylie invited you to The Garden
            </Text>
            <Text size="$label/s" color="$white" opacity={0.8}>
              join.tlon.io
            </Text>
          </YStack>
        </ZStack>
      </ZStack>
    </View>
  );
};
