import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { YStack } from 'tamagui';

import { BucketsLiveFile } from '../../features/buckets/BucketsLiveFile';
import type { RootStackParamList } from '../../navigation/types';
import { BucketsGate } from '../../ui/components/BucketsChannel/BucketsPostCollection';

type Props = NativeStackScreenProps<RootStackParamList, 'BucketFile'>;

export function BucketFileScreen(props: Props) {
  const { channelId, entryId } = props.route.params;

  return (
    <YStack flex={1} backgroundColor="$background">
      <BucketsGate channelId={channelId}>
        {(flag) => (
          <BucketsLiveFile
            entryId={entryId}
            flag={flag}
            onClose={() => props.navigation.goBack()}
          />
        )}
      </BucketsGate>
    </YStack>
  );
}
