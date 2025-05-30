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
    <QueryClientProvider client={queryClient}>
      <TelemetryProvider>
        <TamaguiProvider defaultTheme={tamaguiState?.defaultTheme}>
          <StoreProvider>
            <ShipProvider>
              <SafeAreaProvider>
                <PortalProvider>
                  <ToastProvider>
                    <MigrationCheck {...migrationState}>
                      {children}
                    </MigrationCheck>
                  </ToastProvider>
                </PortalProvider>
              </SafeAreaProvider>
            </ShipProvider>
          </StoreProvider>
        </TamaguiProvider>
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
