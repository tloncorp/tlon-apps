import { config } from '@tloncorp/ui';
import { TamaguiProvider, TamaguiProviderProps } from 'tamagui';

export function Provider({
  children,
  ...rest
}: Omit<TamaguiProviderProps, 'config'>) {
  return (
    <TamaguiProvider {...rest} config={config}>
      {children}
    </TamaguiProvider>
  );
}
