import { createShortCodeFromTitle } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useState } from 'react';
import { YStack } from 'tamagui';

import { triggerHaptic } from '../../utils';
import { PrimaryButton } from '../Buttons';
import { Field, TextInput } from '../Form';

export function CreateGroupWidget(props: {
  invitees: string[];
  onCreatedGroup: (group: db.Group) => void;
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
      const group = await store.createGroup({
        title: groupName,
        memberIds: props.invitees,
      });

      props.onCreatedGroup(group);
      triggerHaptic('success');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [groupName, props]);

  return (
    <YStack flex={1} gap="$2xl" padding="$2xl">
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
