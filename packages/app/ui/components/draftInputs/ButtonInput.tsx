import * as domain from '@tloncorp/shared/domain';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from 'tamagui';

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
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ padding: 8 }}>
      <Button
        style={{
          backgroundColor: 'hsla(0, 0%, 0%, 0.1)',
          height: 60,
          fontWeight: 'bold',
        }}
        onPress={() => {
          const draft: domain.PostDataDraft = {
            channelId: draftInputContext.channel.id,
            content: [messageText],
            attachments: [],
            channelType: draftInputContext.channel.type,
            replyToPostId: null,
          };
          draftInputContext.sendPostFromDraft(draft);
        }}
      >
        {labelText}
      </Button>
    </SafeAreaView>
  );
}
