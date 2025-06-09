import { QueryClientProvider, queryClient } from '@tloncorp/shared/api';
import { ToastProvider } from '@tloncorp/ui';
import { PropsWithChildren } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ShipProvider } from '../contexts/ship';
import { PortalProvider, StoreProvider } from '../ui';
import { Provider as TamaguiProvider } from './';
import { TelemetryProvider } from './TelemetryProvider';

interface MigrationState {
  success: boolean;
  error: string | null;
}

interface BaseProviderStackProps {
  migrationState: MigrationState;
  tamaguiState?: { defaultTheme?: string };
}

export function BaseProviderStack({
  tamaguiState,
  migrationState,
  children,
}: PropsWithChildren<BaseProviderStackProps>) {
  return (
    <GlobalProviderStack>
      <UIProviderStack tamaguiState={tamaguiState}>
        <AppProviderStack migrationState={migrationState}>
          {children}
        </AppProviderStack>
      </UIProviderStack>
    </GlobalProviderStack>
  );
}

/**
 * Providers that depend on other providers farther up the stack
 */
function AppProviderStack({
  children,
  migrationState,
}: PropsWithChildren<{
  migrationState: MigrationState;
}>) {
  return (
    <ToastProvider>
      <MigrationCheck {...migrationState}>{children}</MigrationCheck>
    </ToastProvider>
  );
}

/**
 * Providers required by UI components, such as Tamagui and SafeArea
 */
function UIProviderStack({
  tamaguiState,
  children,
}: PropsWithChildren<{
  tamaguiState?: { defaultTheme?: string };
}>) {
  return (
    <TamaguiProvider defaultTheme={tamaguiState?.defaultTheme}>
      <SafeAreaProvider>
        {/* 
          Android mobile does not proxy portal contexts, so any providers 
          used by portaled components must be *above* the PortalProvider
        */}
        <PortalProvider>{children}</PortalProvider>
      </SafeAreaProvider>
    </TamaguiProvider>
  );
}

/**
 * Global logic + providers not dependent on UI
 */
function GlobalProviderStack({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <TelemetryProvider>
        <StoreProvider>
          <ShipProvider>{children}</ShipProvider>
        </StoreProvider>
      </TelemetryProvider>
    </QueryClientProvider>
  );
}

function MigrationCheck({
  success,
  error,
  children,
}: PropsWithChildren<MigrationState>) {
  if (!success && !error) {
    return null;
  }
  if (error) {
    throw error;
  }
  return <>{children}</>;
}
