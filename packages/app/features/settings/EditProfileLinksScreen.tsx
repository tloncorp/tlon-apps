import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as domain from '@tloncorp/shared/domain';
import {
  EditProfileLinksPane,
  View,
  useContact,
  useCurrentUserId,
} from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';

import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfileLinks'>;

export function EditProfileLinksScreen(props: Props) {
  const onGoBack = useCallback(() => {
    props.navigation.goBack();
  }, [props.navigation]);

  const userId = useCurrentUserId();
  const contact = useContact(userId);
  const initialLinks = useMemo(() => {
    return (contact?.links || []) as domain.ProfileLink[];
  }, [contact]);

  return (
    <View flex={1}>
      <EditProfileLinksPane onGoBack={onGoBack} initialLinks={initialLinks} />
    </View>
  );
}
