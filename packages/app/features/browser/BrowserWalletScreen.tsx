import { View } from 'tamagui';
import { ScreenHeader, SettingsContentScrollView } from '../../ui';
import { BrowserPaymentContent } from './BrowserPayment';
import { BrowserWalletConnectCard } from './BrowserWalletConnectCard';
import { useBrowserWallet } from './useBrowserWallet';

export function BrowserWalletScreen({
  navigation,
  route,
}: {
  navigation: { goBack(): void };
  route: { params: { requestId: string } };
}) {
  const wallet = useBrowserWallet(route.params.requestId);
  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        backAction={() => navigation.goBack()}
        title="Payment request"
      />
      <SettingsContentScrollView>
        {wallet.view?.connection_mode === 'tlon_oauth' ? (
          <BrowserWalletConnectCard
            view={wallet.view}
            walletError={wallet.error}
            onRetry={wallet.onRetry}
          />
        ) : (
          <BrowserPaymentContent {...wallet} />
        )}
      </SettingsContentScrollView>
    </View>
  );
}
