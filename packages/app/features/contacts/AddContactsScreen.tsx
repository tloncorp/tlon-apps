import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/store';
import { AddContactsView } from '@tloncorp/ui';
import { useCallback } from 'react';

import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AddContacts'>;

export function AddContactsScreen(props: Props) {
  const handleAddContacts = useCallback((addIds: string[]) => {
    store.addContacts(addIds);
  }, []);

  return (
    <AddContactsView
      goBack={() => props.navigation.goBack()}
      addContacts={handleAddContacts}
    />
  );
}
