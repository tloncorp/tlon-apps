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

function StateDetail({
  children,
  testID,
}: PropsWithChildren<{ testID?: string }>) {
  return (
    <Text
      size="$label/m"
      color="$secondaryText"
      textAlign="center"
      testID={testID}
    >
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
 * The app's code failed before it ever drew — the "surface halted" state.
 *
 * Distinct from `SurfaceBundleUnavailableState`: the bytes are fine and
 * verified, and it is running them that failed. So the affordance is a
 * reload of the sandbox (a fresh session for the same bundle), not a refetch.
 *
 * `detail` is sandbox-chosen text and stays ON DEVICE. Under the F6 rules
 * that is exactly where it may go: telemetry carries only a host-derived
 * enum and a counter, never any slice of this string, because a bounded
 * prefix of attacker-chosen text is still an exfiltration channel, only a
 * slower one. The person looking at a broken dashboard is precisely who
 * should see the message.
 */
export function SurfaceHaltedState({
  detail,
  onReload,
}: {
  detail?: string;
  onReload?: () => void;
}) {
  return (
    <StateFrame testID="SurfaceHaltedState">
      <StateTitle>This dashboard stopped before it could load</StateTitle>
      <StateDetail>
        Its app hit an error on startup. Nothing you did caused this, and
        nothing in the dashboard has been lost.
      </StateDetail>
      {detail != null && detail !== '' && (
        <StateDetail testID="SurfaceHaltedDetail">{detail}</StateDetail>
      )}
      {onReload != null && (
        <Button
          preset="primary"
          label="Reload"
          onPress={onReload}
          testID="SurfaceHaltedReload"
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
