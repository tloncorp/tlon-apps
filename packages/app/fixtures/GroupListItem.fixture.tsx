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

function mutedSpecimen(title: string, muted: boolean, count: number) {
  return {
    ...groupWithColorAndNoImage,
    id: `${groupWithColorAndNoImage.id}-${title}`,
    title,
    volumeSettings: muted
      ? {
          itemId: groupWithColorAndNoImage.id,
          itemType: 'group' as const,
          level: 'soft' as const,
        }
      : null,
    unread: {
      groupId: groupWithColorAndNoImage.id,
      updatedAt: Date.now(),
      count,
      notify: false,
      notifyCount: 0,
    },
  };
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
  Muted: (
    <FixtureWrapper fillWidth innerBackgroundColor="$secondaryBackground">
      <View gap="$s" paddingHorizontal="$l">
        <GroupListItem model={mutedSpecimen('Muted, no unreads', true, 0)} />
        <GroupListItem model={mutedSpecimen('Muted, 3 unreads', true, 3)} />
        <GroupListItem model={mutedSpecimen('Unmuted, no unreads', false, 0)} />
        <GroupListItem model={mutedSpecimen('Unmuted, 3 unreads', false, 3)} />
      </View>
    </FixtureWrapper>
  ),
};
