import { Text } from '@tloncorp/ui';
import { YStack } from 'tamagui';

import {
  SurfaceBundleUnavailableState,
  SurfaceDashboardFullBanner,
  SurfaceInvalidDefinitionState,
  SurfaceLoadingState,
  SurfaceMigrationPendingState,
  SurfaceUpdateToViewState,
} from '../ui/components/SurfaceChannel/SurfaceStates';
import { FixtureWrapper } from './FixtureWrapper';

/**
 * Every §6 rendered state as a fixture (§9 fixture list). Where two plan
 * scenarios share a rendered state, the fixture name calls it out:
 * - "deleted snapshot fallback" renders as partial-loading then hydrated;
 * - "late-arriving migration snapshot" is migration-pending → hydrated;
 * - "revision regression" renders whatever the (authoritative) cell says —
 *   at this layer it is just another hydrated/migration-pending state;
 * - "hash mismatch" renders bundle-unavailable;
 * - stale invokes with/without acceptStale have no distinct UI — they are
 *   reducer semantics (folded or dropped server-side of the fold).
 */

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <YStack gap="$s" height={260} borderWidth={1} borderColor="$border">
      <Text size="$label/m" color="$tertiaryText" padding="$s">
        {label}
      </Text>
      {children}
    </YStack>
  );
}

export default {
  Loading: (
    <FixtureWrapper fillWidth>
      <Labeled label="loading (initial hydration)">
        <SurfaceLoadingState />
      </Labeled>
    </FixtureWrapper>
  ),
  'Partial hydration': (
    <FixtureWrapper fillWidth>
      <Labeled label="partial (carries no state by ratified semantics)">
        <SurfaceLoadingState partial />
      </Labeled>
    </FixtureWrapper>
  ),
  'Migration pending': (
    <FixtureWrapper fillWidth>
      <Labeled label="preserveState revision awaiting its migration snapshot (also: migration snapshot deleted)">
        <SurfaceMigrationPendingState />
      </Labeled>
    </FixtureWrapper>
  ),
  'No spec': (
    <FixtureWrapper fillWidth>
      <Labeled label="surface-configured channel with no published spec">
        <SurfaceInvalidDefinitionState variant="absent" />
      </Labeled>
    </FixtureWrapper>
  ),
  'Invalid definition': (
    <FixtureWrapper fillWidth>
      <Labeled label="spec present but fails validation">
        <SurfaceInvalidDefinitionState variant="invalid" />
      </Labeled>
    </FixtureWrapper>
  ),
  'Update to view (spec version)': (
    <FixtureWrapper fillWidth>
      <Labeled label="spec version newer than this client">
        <SurfaceUpdateToViewState reason="spec-version" />
      </Labeled>
    </FixtureWrapper>
  ),
  'Update to view (shell version)': (
    <FixtureWrapper fillWidth>
      <Labeled label="bundle pins a newer shell major">
        <SurfaceUpdateToViewState reason="shell-version" />
      </Labeled>
    </FixtureWrapper>
  ),
  'Bundle unavailable': (
    <FixtureWrapper fillWidth>
      <Labeled label="fetch failed or hash mismatch — retry affordance">
        <SurfaceBundleUnavailableState onRetry={() => {}} />
      </Labeled>
    </FixtureWrapper>
  ),
  'Dashboard full banner': (
    <FixtureWrapper fillWidth>
      <Labeled label="stateFull: banner over the live surface, not a replacement">
        <YStack flex={1}>
          <SurfaceDashboardFullBanner />
          <YStack
            flex={1}
            alignItems="center"
            justifyContent="center"
            backgroundColor="$secondaryBackground"
          >
            <Text color="$secondaryText">(live surface renders here)</Text>
          </YStack>
        </YStack>
      </Labeled>
    </FixtureWrapper>
  ),
};
