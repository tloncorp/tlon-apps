import { GroupListItem, View } from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';
import {
  groupWithColorAndNoImage,
  groupWithImage,
  groupWithLongTitle,
  groupWithNoColorOrImage,
  groupWithSvgImage,
} from './fakeData';

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
};
