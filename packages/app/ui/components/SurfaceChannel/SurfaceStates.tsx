import { Button, LoadingSpinner, Text } from '@tloncorp/ui';
import { PropsWithChildren } from 'react';
import { YStack } from 'tamagui';

/**
 * The §6 rendered states as real UI, host-side in ordinary @tloncorp/ui —
 * every state is distinct and a partial fold is never presented as
 * current. These are deliberately dumb prop-driven components so cosmos
 * fixtures can show each one.
 */

function StateFrame({
  children,
  testID,
}: PropsWithChildren<{ testID?: string }>) {
  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      gap="$l"
      padding="$2xl"
      backgroundColor="$background"
      testID={testID}
    >
      {children}
    </YStack>
  );
}

function StateTitle({ children }: PropsWithChildren) {
  return (
    <Text size="$label/xl" color="$primaryText" textAlign="center">
      {children}
    </Text>
  );
}

function StateDetail({ children }: PropsWithChildren) {
  return (
    <Text size="$label/m" color="$secondaryText" textAlign="center">
      {children}
    </Text>
  );
}

/** initial hydration, and 'partial' (which carries no state by design) */
export function SurfaceLoadingState({ partial }: { partial?: boolean }) {
  return (
    <StateFrame testID="SurfaceLoadingState">
      <LoadingSpinner />
      <StateDetail>
        {partial ? 'Catching up on dashboard history…' : 'Loading dashboard…'}
      </StateDetail>
    </StateFrame>
  );
}

/** preserveState revision with no migration snapshot yet (§6 step 3) */
export function SurfaceMigrationPendingState() {
  return (
    <StateFrame testID="SurfaceMigrationPendingState">
      <LoadingSpinner />
      <StateTitle>Dashboard update in progress</StateTitle>
      <StateDetail>
        This dashboard was just updated and is carrying its data over. It will
        be back in a moment.
      </StateDetail>
    </StateFrame>
  );
}

/**
 * A spec that is present but unusable ('invalid'), or a surface-configured
 * channel with no spec at all ('absent'). Neither ever falls back to the
 * chat renderer (§6 step 1).
 */
export function SurfaceInvalidDefinitionState({
  variant,
}: {
  variant: 'invalid' | 'absent';
}) {
  return (
    <StateFrame testID="SurfaceInvalidDefinitionState">
      <StateTitle>
        {variant === 'absent'
          ? 'This dashboard isn’t set up yet'
          : 'This dashboard has a broken definition'}
      </StateTitle>
      <StateDetail>
        {variant === 'absent'
          ? 'Its app hasn’t been published. Ask the group’s bot to publish it.'
          : 'Ask the group’s bot to publish it again.'}
      </StateDetail>
    </StateFrame>
  );
}

/**
 * The spec (or its bundle) targets something newer than this client: a
 * future spec `version`, or a bundle pinned to a newer shell major.
 */
export function SurfaceUpdateToViewState({
  reason,
}: {
  reason: 'spec-version' | 'shell-version';
}) {
  return (
    <StateFrame testID="SurfaceUpdateToViewState">
      <StateTitle>Update Tlon to view this</StateTitle>
      <StateDetail>
        {reason === 'shell-version'
          ? 'This dashboard uses a newer app runtime than this version of Tlon ships.'
          : 'This dashboard was made with a newer version of Tlon.'}
      </StateDetail>
    </StateFrame>
  );
}

/** bundle fetch failed or hash mismatch — never a render of unverified bytes */
export function SurfaceBundleUnavailableState({
  onRetry,
}: {
  onRetry?: () => void;
}) {
  return (
    <StateFrame testID="SurfaceBundleUnavailableState">
      <StateTitle>Can’t load this dashboard right now</StateTitle>
      <StateDetail>
        The dashboard’s app couldn’t be fetched and verified.
      </StateDetail>
      {onRetry != null && (
        <Button
          preset="primary"
          label="Retry"
          onPress={onRetry}
          testID="SurfaceBundleRetry"
        />
      )}
    </StateFrame>
  );
}

/**
 * `stateFull` banner: rendered OVER the live surface, not instead of it
 * (§7 — appends refused, existing content still shows).
 */
export function SurfaceDashboardFullBanner() {
  return (
    <YStack
      padding="$m"
      backgroundColor="$negativeBackground"
      borderBottomWidth={1}
      borderColor="$negativeBorder"
      testID="SurfaceDashboardFullBanner"
    >
      <Text size="$label/m" color="$negativeActionText" textAlign="center">
        This dashboard is full — new entries can’t be added until its bot
        compacts it.
      </Text>
    </YStack>
  );
}
