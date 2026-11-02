import { View } from 'tamagui';
import { ScreenHeader, SettingsContentScrollView } from '../../ui';
import { BrowserPaymentContent } from './BrowserPayment';
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
        <BrowserPaymentContent {...wallet} />
      </SettingsContentScrollView>
    </View>
  );
}
