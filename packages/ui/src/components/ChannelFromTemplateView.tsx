import { View } from 'tamagui';

import { ScreenHeader } from './ScreenHeader';

export function ChannelFromTemplateView() {
  return (
    <View flex={1} backgroundColor="$background">
      <ScreenHeader
        title={channel ? 'Loading...' : 'Members'}
        backAction={goBack}
      />
    </View>
  );
}
