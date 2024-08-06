import * as db from '@tloncorp/shared/dist/db';
import { SizableText, View, XStack } from 'tamagui';

import { Icon } from './Icon';
import { RadioGroup } from './RadioGroup';

export function GroupNotificationsWidget(props: { group: db.Group }) {
  return (
    <View>
      <XStack flex={1}>
        <Icon type="ChevronLeft" size="$m" />
        <SizableText>Group notification settings</SizableText>
        <Icon type="ChevronRight" size="$m" opacity={0} />
      </XStack>
      <RadioGroup>
        <RadioGroup.Option
          label="All activity"
          value="all"
          onSelect={() => {}}
          selected={true}
        />
        <RadioGroup.Option
          label="Posts, mentions, and replies"
          value="pmr"
          onSelect={() => {}}
          selected={false}
        />
        <RadioGroup.Option
          label="Only mentions and replies"
          value="normal"
          onSelect={() => {}}
          selected={false}
        />
        <RadioGroup.Option
          label="Fully muted"
          value="fullMute"
          onSelect={() => {}}
          selected={false}
        />
      </RadioGroup>
    </View>
  );
}
