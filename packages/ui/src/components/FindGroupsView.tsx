import { useCallback } from 'react';
import { Text, View, YStack } from 'tamagui';

import { ContactBook } from './ContactBook';
import { ScreenHeader } from './ScreenHeader';

export function FindGroupsView({
  goBack,
  goToContactHostedGroups,
}: {
  goBack: () => void;
  goToContactHostedGroups: (params: { contactId: string }) => void;
}) {
  const handleContactSelected = useCallback(
    (contactId: string) => {
      console.log('go to contact hosted groups', contactId);
      goToContactHostedGroups({ contactId: contactId });
    },
    [goToContactHostedGroups]
  );

  return (
    <View flex={1}>
      <ScreenHeader title="Find groups" backAction={goBack} />
      <ContactBook
        searchable
        searchPlaceholder="Search by nickname or user ID"
        onSelect={handleContactSelected}
        explanationComponent={<GroupJoinExplanation />}
      />
    </View>
  );
}

const GroupJoinExplanation = () => (
  <YStack height="80%" justifyContent="center" alignItems="center" gap="$m">
    <Text>On Tlon, people host groups.</Text>
    <Text>Look for groups hosted by people above.</Text>
  </YStack>
);
