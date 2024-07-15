import { createShortCodeFromTitle } from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback, useState } from 'react';
import { TextInput } from 'react-native';
import { getTokenValue } from 'tamagui';

import { SizableText, XStack, YStack, useTheme } from '../../core';
import { triggerHaptic } from '../../utils';
import { PrimaryButton } from '../Buttons';
import { Icon } from '../Icon';

export function CreateGroupWidget(props: {
  goBack: () => void;
  onCreatedGroup: ({
    group,
    channel,
  }: {
    group: db.Group;
    channel: db.Channel;
  }) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [groupName, setGroupName] = useState('');
  const theme = useTheme();

  const onCreateGroup = useCallback(async () => {
    const shortCode = createShortCodeFromTitle(groupName);
    if (groupName.length < 3 || shortCode.length < 3) {
      return;
    }

    setLoading(true);

    try {
      const { group, channel } = await store.createGroup({
        title: groupName,
        shortCode,
      });
      props.onCreatedGroup({ group, channel });
      triggerHaptic('success');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [groupName, props]);

  return (
    <YStack flex={1} gap="$2xl">
      <XStack justifyContent="space-between" alignItems="center">
        <Icon type="ChevronLeft" onPress={() => props.goBack()} />
        <SizableText fontWeight="$xl">Start a New Group</SizableText>
        <Icon type="ChevronRight" opacity={0} />
      </XStack>
      <SizableText size="$m">What is your group about?</SizableText>
      {/* TODO: make tamagui input cohere */}
      <TextInput
        style={{
          borderRadius: getTokenValue('$l', 'radius'),
          borderWidth: 1,
          borderColor: theme.primaryText.val,
          padding: getTokenValue('$xl', 'space'),
          fontSize: 17,
        }}
        autoFocus
        autoComplete="off"
        spellCheck={false}
        maxLength={100}
        onChangeText={setGroupName}
        placeholder="Group name"
      />
      <PrimaryButton
        disabled={groupName.length < 3 || loading}
        loading={loading}
        onPress={onCreateGroup}
      >
        Create Group
      </PrimaryButton>
    </YStack>
  );
}
