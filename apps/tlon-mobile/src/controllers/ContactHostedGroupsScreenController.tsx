import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ContactHostedGroupsScreen } from '@tloncorp/app/features/top/ContactHostedGroupsScreen';

import { RootStackParamList } from '../types';

type ContactHostedGroupsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'ContactHostedGroups'
>;

export function ContactHostedGroupsScreenController({
  navigation,
  route,
}: ContactHostedGroupsScreenProps) {
  return (
    <ContactHostedGroupsScreen
      contactId={route.params?.contactId}
      goBack={() => navigation.goBack()}
    />
  );
}
