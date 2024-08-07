import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import * as ub from '@tloncorp/shared/dist/urbit';
import { useCallback } from 'react';
import { SizableText, View, XStack } from 'tamagui';

import { Icon } from './Icon';
import { RadioGroup } from './RadioGroup';

export function GroupNotificationsPane(props: {
  group?: db.Group;
  onBack: () => void;
}) {
  const { data: currentVolumeLevel } = store.useGroupVolumeLevel(
    props.group?.id ?? ''
  );

  const handleVolumeUpdate = useCallback(
    (newLevel: ub.NotificationLevel) => {
      console.log(`component setting volume`, newLevel);
      if (props.group) {
        store.setGroupVolumeLevel({ group: props.group, level: newLevel });
      }
    },
    [props.group]
  );

  return (
    <View>
      <XStack flex={1}>
        <Icon type="ChevronLeft" size="$m" onPress={props.onBack} />
        <SizableText>Group notification settings</SizableText>
        <Icon type="ChevronRight" size="$m" opacity={0} />
      </XStack>
      <RadioGroup>
        {/* TODO: handle default? */}
        <RadioGroup.Option
          label="All activity"
          value="loud"
          onSelect={handleVolumeUpdate}
          selected={currentVolumeLevel === 'loud'}
        />
        <RadioGroup.Option
          label="Posts, mentions, and replies"
          value="medium"
          onSelect={handleVolumeUpdate}
          selected={currentVolumeLevel === 'medium'}
        />
        <RadioGroup.Option
          label="Only mentions and replies"
          value="soft"
          onSelect={handleVolumeUpdate}
          selected={currentVolumeLevel === 'soft'}
        />
        <RadioGroup.Option
          label="None shall pass"
          value="hush"
          onSelect={handleVolumeUpdate}
          selected={currentVolumeLevel === 'hush'}
        />
      </RadioGroup>
    </View>
  );
}
