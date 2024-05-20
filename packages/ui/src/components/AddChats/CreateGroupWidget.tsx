import { createShortCodeFromTitle } from '@tloncorp/shared/dist';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback, useState } from 'react';
import { TextInput } from 'react-native';
import { getTokenValue } from 'tamagui';

import { useAddChatHandlers } from '../../contexts';
import { SizableText, XStack, YStack, useTheme } from '../../core';
import { Button } from '../Button';
import { Icon } from '../Icon';

export function CreateGroupWidget(props: {
  currentUserId: string;
  goBack: () => void;
}) {
  const handlers = useAddChatHandlers();
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
      console.log(`//// Starting Create Group Flow ////`);
      const { group, channel } = await store.createGroup({
        currentUserId: props.currentUserId,
        title: groupName,
        shortCode,
      });
      handlers.onCreatedGroup({ group, channel });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [groupName, handlers, props.currentUserId]);

  return (
    <YStack flex={1} gap="$2xl">
      <XStack justifyContent="space-between" alignItems="center">
        <Icon type="ChevronLeft" onPress={() => props.goBack()} />
        <SizableText fontWeight="500">Start a New Group</SizableText>
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
      <Button hero disabled={groupName.length < 3} onPress={onCreateGroup}>
        <Button.Text>Create Group</Button.Text>
        {loading && (
          <Button.Icon>
            <Icon type="Bang" />
          </Button.Icon>
        )}
      </Button>
    </YStack>
  );
}
