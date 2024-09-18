import { createShortCodeFromTitle } from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback, useState } from 'react';
import { SizableText, XStack, YStack } from 'tamagui';

import { triggerHaptic } from '../../utils';
import { PrimaryButton } from '../Buttons';
import { Field, TextInput } from '../Form';
import { Icon } from '../Icon';

export function CreateGroupWidget(props: {
  goBack: () => void;
  invitees: string[];
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

      await store.inviteGroupMembers({
        groupId: group.id,
        contactIds: props.invitees,
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
        <SizableText fontWeight="$xl">New Group</SizableText>
        <Icon type="ChevronRight" opacity={0} />
      </XStack>
      <YStack gap="$s">
        <Field label="Group Name (Required)" required>
          <TextInput
            autoFocus
            autoComplete="off"
            spellCheck={false}
            maxLength={100}
            onChangeText={setGroupName}
            placeholder="Group name"
          />
        </Field>
      </YStack>
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
