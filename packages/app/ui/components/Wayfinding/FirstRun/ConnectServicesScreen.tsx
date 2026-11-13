import { LoadingSpinner, Pressable, Text } from '@tloncorp/ui';
import { useState } from 'react';
import { View, XStack, YStack, useTheme } from 'tamagui';

import { McpProviderLogo } from '../../McpProviderLogo';
import { useOnboardingGlyph } from '../../Onboarding/line/AvatarGlyphPicker';
import {
  ART_TO_CONTENT_GAP,
  LineStepFrame,
} from '../../Onboarding/line/LineStepFrame';
import { LineIcon } from '../../Onboarding/line/lineIcons';
import { LineOutline, LineRule } from '../../Onboarding/line/lineKit';
import { ConnectArt } from '../../Onboarding/line/onboardingArt';
import { FirstRunSheet } from './FirstRunSheet';
import { FIRST_RUN_STEPS, firstRunCopy } from './firstRunCopy';
import {
  type FeaturedRowState,
  type FeaturedService,
  type ServiceAttempt,
  featuredRowState,
} from './firstRunServices';

const copy = firstRunCopy.connect;
const LOGO_SIZE = 40;
/** McpProviderLogo's corner, the `$s` radius. */
const LOGO_RADIUS = 6;

/**
 * Connect your services. Connecting happens here: Connect opens a short
 * access sheet, then the provider; afterwards a row shows only what the
 * account's grants confirm. The drawing gives each service a line, solid once
 * it's connected. Continue always works; it stays gray until something is
 * connected, so Connect reads first.
 */
export function ConnectServicesScreen({
  unavailable,
  featured,
  attempts,
  allServicesCount,
  anyConnected,
  busy = false,
  onStartConnect,
  onCheckAgain,
  onAllServices,
  onContinue,
  onBack,
  initialSheetProviderId,
}: {
  /** No way to connect for this account, or nothing to offer. */
  unavailable: boolean;
  featured: FeaturedService[];
  attempts: Record<string, ServiceAttempt | undefined>;
  /** Null while the full list is still loading. */
  allServicesCount: number | null;
  anyConnected: boolean;
  /** Another connect or disconnect is running, so new sign-ins wait. */
  busy?: boolean;
  onStartConnect: (providerId: string) => void;
  onCheckAgain: (providerId: string) => void;
  onAllServices: () => void;
  onContinue: () => void;
  onBack: () => void;
  /** Opens a service's access sheet on mount, for fixtures. */
  initialSheetProviderId?: string;
}) {
  const [sheetService, setSheetService] = useState<FeaturedService | null>(
    () =>
      featured.find((service) => service.row.id === initialSheetProviderId) ??
      null
  );
  const [sheetOpen, setSheetOpen] = useState(!!initialSheetProviderId);
  const signInInFlight = busy || Object.values(attempts).includes('connecting');

  const glyph = useOnboardingGlyph();
  const states = featured.map((service) =>
    featuredRowState(service.row, attempts[service.row.id])
  );

  const openSheet = (service: FeaturedService) => {
    setSheetService(service);
    setSheetOpen(true);
  };

  return (
    <LineStepFrame
      step={FIRST_RUN_STEPS.connect}
      onBack={onBack}
      title={copy.title}
      subtitle={copy.subtitle}
      primary={{
        label: anyConnected ? copy.primaryConnected : copy.primaryNone,
        tone: anyConnected ? 'primary' : 'quiet',
        onPress: onContinue,
        testID: 'first-run-primary',
      }}
      testID="first-run-connect"
      overlay={
        sheetService ? (
          <ServiceAccessSheet
            service={sheetService}
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            onContinue={() => {
              setSheetOpen(false);
              onStartConnect(sheetService.row.id);
            }}
          />
        ) : null
      }
    >
      {unavailable ? (
        <View
          marginHorizontal="$2xl"
          padding="$xl"
          accessibilityLiveRegion="polite"
          testID="first-run-connect-none"
        >
          <Text fontSize={16} lineHeight={24} color="$primaryText">
            {copy.none}
          </Text>
          <LineOutline radius={16} />
        </View>
      ) : (
        <>
          <ConnectArt
            glyph={glyph}
            connected={states.map((state) => state === 'connected')}
          />
          <YStack
            marginTop={ART_TO_CONTENT_GAP}
            marginHorizontal="$2xl"
            borderRadius={16}
            overflow="hidden"
          >
            {featured.map((service, index) => (
              <ServiceRow
                key={service.row.id}
                service={service}
                state={states[index]}
                first={index === 0}
                disabled={signInInFlight}
                onConnect={() => openSheet(service)}
                onCheckAgain={() => onCheckAgain(service.row.id)}
              />
            ))}
            <Pressable
              onPress={onAllServices}
              accessibilityRole="button"
              accessibilityLabel={
                allServicesCount === null
                  ? copy.allServices
                  : `${copy.allServices}, ${allServicesCount}`
              }
              testID="first-run-all-services"
            >
              <XStack
                height={52}
                paddingHorizontal={14}
                alignItems="center"
                gap="$m"
              >
                {featured.length ? <LineRule /> : null}
                <Text
                  flex={1}
                  fontSize={15}
                  lineHeight={20}
                  color="$primaryText"
                >
                  {copy.allServices}
                </Text>
                {allServicesCount === null ? null : (
                  <Text fontSize={15} lineHeight={20} color="$secondaryText">
                    {allServicesCount}
                  </Text>
                )}
                <AllServicesChevron />
              </XStack>
            </Pressable>
            <LineOutline radius={16} />
          </YStack>
        </>
      )}
    </LineStepFrame>
  );
}

function AllServicesChevron() {
  const theme = useTheme();
  return (
    <LineIcon
      name="chevronRight"
      size={16}
      color={theme.secondaryText?.val as string}
      strokeWidth={1.5}
    />
  );
}

function ServiceRow({
  service,
  state,
  first,
  disabled,
  onConnect,
  onCheckAgain,
}: {
  service: FeaturedService;
  state: FeaturedRowState;
  first: boolean;
  disabled: boolean;
  onConnect: () => void;
  onCheckAgain: () => void;
}) {
  const { row, access } = service;
  const line =
    state === 'connected'
      ? copy.connectedLine
      : state === 'connecting'
        ? copy.connectingLine
        : state === 'cancelled'
          ? copy.cancelledLine
          : state === 'failed'
            ? copy.failedLine
            : state === 'checking'
              ? copy.checkingLine(access.company)
              : access.summary;
  const lineNeedsAttention = state === 'cancelled' || state === 'failed';
  const button =
    state === 'idle'
      ? { label: copy.connectButton, onPress: onConnect }
      : state === 'cancelled' || state === 'failed'
        ? { label: copy.tryAgainButton, onPress: onConnect }
        : state === 'checking'
          ? { label: copy.checkAgainButton, onPress: onCheckAgain }
          : null;

  return (
    <XStack
      minHeight={64}
      paddingVertical="$m"
      paddingHorizontal={14}
      alignItems="center"
      gap={12}
      testID={`first-run-service-${row.id}`}
    >
      {first ? null : <LineRule />}
      <View width={LOGO_SIZE} height={LOGO_SIZE}>
        <McpProviderLogo
          displayName={row.displayName}
          logoUrl={row.logoUrl}
          providerId={row.id}
          size={LOGO_SIZE}
          borderWidth={0}
        />
        <LineOutline radius={LOGO_RADIUS} />
      </View>
      <YStack flex={1}>
        <Text
          fontSize={16}
          lineHeight={22}
          letterSpacing={-0.2}
          color="$primaryText"
        >
          {row.displayName}
        </Text>
        <Text
          fontSize={14}
          lineHeight={20}
          letterSpacing={-0.1}
          color={lineNeedsAttention ? '$primaryText' : '$secondaryText'}
          accessibilityLiveRegion="polite"
        >
          {line}
        </Text>
      </YStack>
      {state === 'connected' ? (
        <XStack alignItems="center" gap={4} flexShrink={0}>
          <LineIcon name="check" size={14} />
          <Text fontSize={14} lineHeight={20} color="$primaryText">
            {copy.connectedBadge}
          </Text>
        </XStack>
      ) : null}
      {state === 'checking' || state === 'connecting' ? (
        <View
          width={14}
          height={14}
          alignItems="center"
          justifyContent="center"
          accessible
          accessibilityLabel={copy.checkingA11y}
        >
          <View transform={[{ scale: 0.7 }]}>
            <LoadingSpinner size="small" color="$secondaryText" />
          </View>
        </View>
      ) : null}
      {button ? (
        <Pressable
          onPress={disabled ? undefined : button.onPress}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`${button.label} ${row.displayName}`}
          testID={`first-run-service-${row.id}-button`}
        >
          <View
            height={32}
            paddingHorizontal={12}
            borderRadius={16}
            backgroundColor="$secondaryBackground"
            justifyContent="center"
            opacity={disabled ? 0.5 : 1}
          >
            <Text
              fontSize={14}
              lineHeight={20}
              color="$primaryText"
              numberOfLines={1}
            >
              {button.label}
            </Text>
          </View>
        </Pressable>
      ) : null}
    </XStack>
  );
}

function ServiceAccessSheet({
  service,
  open,
  onOpenChange,
  onContinue,
}: {
  service: FeaturedService;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
}) {
  const sheet = firstRunCopy.accessSheet;
  const { row, access } = service;
  return (
    <FirstRunSheet
      open={open}
      onOpenChange={onOpenChange}
      title={sheet.title(row.displayName)}
      icon={
        <McpProviderLogo
          displayName={row.displayName}
          logoUrl={row.logoUrl}
          providerId={row.id}
          size={44}
        />
      }
      intro={access.intro}
      rows={[
        {
          key: 'access',
          label: sheet.accessLabel(access.accessMode),
          title: access.access,
        },
        { key: 'account', label: sheet.accountLabel, title: access.account },
        {
          key: 'disconnect',
          label: sheet.disconnectLabel,
          title: sheet.disconnectLine,
        },
      ]}
      footnote={sheet.footnote}
      primaryLabel={sheet.continue(row.displayName)}
      onPrimary={onContinue}
      secondaryLabel={sheet.cancel}
      onSecondary={() => onOpenChange(false)}
      testID="first-run-access-sheet"
    />
  );
}
