import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, View } from 'tamagui';

import { DraftInputContext } from './shared';

export function ButtonInput({
  draftInputContext,
  messageText,
  labelText,
}: {
  draftInputContext: DraftInputContext;
  messageText: string;
  labelText: string;
}) {
  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={{
        padding: 8,

        // backgroundColor: 'green',
      }}
    >
      <Button
        style={{
          backgroundColor: 'hsla(0, 0%, 0%, 0.1)',
          height: 60,
          fontWeight: 'bold',
        }}
        onPress={() => {
          draftInputContext.send(
            [{ inline: [messageText] }],
            draftInputContext.channel.id
          );
        }}
      >
        {labelText}
      </Button>
    </SafeAreaView>
  );
}
