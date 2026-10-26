import { Icon, LoadingSpinner, Pressable, Text } from '@tloncorp/ui';
import { useState } from 'react';
import { View, XStack, YStack } from 'tamagui';

import { McpProviderLogo } from '../../McpProviderLogo';
import { FirstRunFrame } from './FirstRunFrame';
import { FirstRunSheet } from './FirstRunSheet';
import { firstRunCopy } from './firstRunCopy';
import {
  type FeaturedRowState,
  type FeaturedService,
  type ServiceAttempt,
  featuredRowState,
} from './firstRunServices';
import type { FirstRunSetupStatus } from './types';

const copy = firstRunCopy.connect;
const LOGO_SIZE = 40;

/**
 * Screen 3. Connecting happens here: Connect opens a short access sheet, then
 * the provider; afterwards a row shows only what the account's grants
 * confirm. Continue always works.
 */
export function ConnectServicesScreen({
  status,
  loading,
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
  status: FirstRunSetupStatus;
  loading: boolean;
  /** No catalog for this account, or nothing in it. */
  unavailable: boolean;
  featured: FeaturedService[];
  attempts: Record<string, ServiceAttempt | undefined>;
  allServicesCount: number;
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

  const openSheet = (service: FeaturedService) => {
    setSheetService(service);
    setSheetOpen(true);
  };

  return (
    <FirstRunFrame
      step={3}
      onBack={onBack}
      title={copy.title}
      accent={copy.accent}
      body={copy.body}
      status={status}
      primaryLabel={anyConnected ? copy.primaryConnected : copy.primaryNone}
      onPrimary={onContinue}
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
      {loading ? (
        <View marginTop="$2xl" alignItems="center">
          <LoadingSpinner />
        </View>
      ) : unavailable ? (
        <View
          marginTop={20}
          marginHorizontal="$xl"
          padding="$xl"
          borderRadius={16}
          backgroundColor="$secondaryBackground"
          accessibilityLiveRegion="polite"
          testID="first-run-connect-none"
        >
          <Text fontSize={16} lineHeight={24} color="$primaryText">
            {copy.none}
          </Text>
        </View>
      ) : (
        <YStack marginTop={20} marginHorizontal="$xl">
          <YStack
            borderWidth={1}
            borderColor="$border"
            borderRadius={16}
            overflow="hidden"
          >
            {featured.map((service) => (
              <ServiceRow
                key={service.row.id}
                service={service}
                state={featuredRowState(service.row, attempts[service.row.id])}
                disabled={signInInFlight}
                onConnect={() => openSheet(service)}
                onCheckAgain={() => onCheckAgain(service.row.id)}
              />
            ))}
            <Pressable
              onPress={onAllServices}
              accessibilityRole="button"
              accessibilityLabel={`${copy.allServices}, ${allServicesCount}`}
              testID="first-run-all-services"
            >
              <XStack
                height={48}
                paddingHorizontal={14}
                alignItems="center"
                gap="$m"
              >
                <Text
                  flex={1}
                  fontSize={15}
                  lineHeight={20}
                  fontWeight="500"
                  color="$primaryText"
                >
                  {copy.allServices}
                </Text>
                <Text fontSize={15} lineHeight={20} color="$secondaryText">
                  {allServicesCount}
                </Text>
                <Icon
                  type="ChevronRight"
                  customSize={[16, 16]}
                  color="$tertiaryText"
                />
              </XStack>
            </Pressable>
          </YStack>
          <Text
            marginTop="$l"
            fontSize={14}
            lineHeight={20}
            color="$secondaryText"
          >
            {copy.footnote}
          </Text>
        </YStack>
      )}
    </FirstRunFrame>
  );
}

function ServiceRow({
  service,
  state,
  disabled,
  onConnect,
  onCheckAgain,
}: {
  service: FeaturedService;
  state: FeaturedRowState;
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
      paddingVertical="$l"
      paddingHorizontal={14}
      alignItems="center"
      gap="$l"
      borderBottomWidth={1}
      borderColor="$border"
      testID={`first-run-service-${row.id}`}
    >
      <McpProviderLogo
        displayName={row.displayName}
        logoUrl={row.logoUrl}
        providerId={row.id}
        size={LOGO_SIZE}
      />
      <YStack flex={1}>
        <Text
          fontSize={16}
          lineHeight={22}
          fontWeight="500"
          color="$primaryText"
        >
          {row.displayName}
        </Text>
        <Text
          fontSize={14}
          lineHeight={20}
          color={lineNeedsAttention ? '$primaryText' : '$secondaryText'}
          accessibilityLiveRegion="polite"
        >
          {line}
        </Text>
      </YStack>
      {state === 'connected' ? (
        <XStack alignItems="center" gap="$xs" flexShrink={0}>
          <Icon type="Checkmark" customSize={[14, 14]} color="$primaryText" />
          <Text
            fontSize={14}
            lineHeight={20}
            fontWeight="500"
            color="$primaryText"
          >
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
            paddingHorizontal="$l"
            borderRadius={16}
            backgroundColor="$secondaryBackground"
            justifyContent="center"
            opacity={disabled ? 0.5 : 1}
          >
            <Text
              fontSize={14}
              lineHeight={20}
              fontWeight="500"
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
