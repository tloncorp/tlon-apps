import { useFixtureInput } from 'react-cosmos/client';

import { GroupListItem, View } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';
import {
  groupWithColorAndNoImage,
  groupWithImage,
  groupWithLongTitle,
  groupWithNoColorOrImage,
  groupWithSvgImage,
} from './fakeData';

function ParameterizedGroupListItemFixture() {
  const [unreadCount] = useFixtureInput('Unread Count', 512);
  const [notify] = useFixtureInput('Notify', false);
  const [notifyCount] = useFixtureInput('Notify Count', 0);

  return (
    <FixtureWrapper fillWidth innerBackgroundColor="$secondaryBackground">
      <View gap="$s" paddingHorizontal="$l">
        <GroupListItem
          model={{
            ...groupWithColorAndNoImage,
            unread: {
              groupId: groupWithColorAndNoImage.id,
              updatedAt: Date.now(),
              count: unreadCount,
              notify,
              notifyCount,
            },
          }}
        />
      </View>
    </FixtureWrapper>
  );
}

export default {
  basic: (
    <FixtureWrapper fillWidth innerBackgroundColor="$secondaryBackground">
      <View gap="$s" paddingHorizontal="$l">
        <GroupListItem model={groupWithColorAndNoImage} />
        <GroupListItem model={groupWithImage} />
        <GroupListItem model={groupWithSvgImage} />
        <GroupListItem model={groupWithLongTitle} />
        <GroupListItem model={groupWithNoColorOrImage} />
      </View>
    </FixtureWrapper>
  ),
  'Parameterized Unread': <ParameterizedGroupListItemFixture />,
};
