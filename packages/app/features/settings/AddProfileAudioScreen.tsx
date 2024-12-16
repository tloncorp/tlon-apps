import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as domain from '@tloncorp/shared/domain';
import {
  AddProfileAudioScreenView,
  ScreenHeader,
  View,
  useContact,
} from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AddProfileAudio'>;

export function AddProfileAudioScreen(props: Props) {
  const goBack = useCallback(() => {
    props.navigation.goBack();
  }, [props.navigation]);

  const currentUserId = useCurrentUserId();
  const contact = useContact(currentUserId);
  const currentlyPinned = useMemo(() => {
    return (contact?.tunes as domain.NormalizedTrack[]) || [];
  }, [contact]);

  return (
    <View flex={1}>
      <AddProfileAudioScreenView
        goBack={goBack}
        initialTunes={currentlyPinned}
      />
    </View>
  );
}
