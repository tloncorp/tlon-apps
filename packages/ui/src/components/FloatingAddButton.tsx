import { ListItem, Popover, YStack } from 'tamagui';

import { FloatingActionButton } from './FloatingActionButton';
import { Icon } from './Icon';

export function FloatingAddButton({
  setAddGroupOpen,
  setStartDmOpen,
}: {
  setAddGroupOpen: (open: boolean) => void;
  setStartDmOpen: (open: boolean) => void;
}) {
  return (
    <Popover size="$s" allowFlip placement="top" offset={8}>
      <Popover.Anchor>
        <Popover.Trigger asChild>
          <FloatingActionButton
            icon={<Icon type="Add" size="$s" marginRight="$s" />}
            label={'Add'}
            onPress={() => {}}
          />
        </Popover.Trigger>
      </Popover.Anchor>
      <Popover.Content
        borderWidth={1}
        borderColor="$border"
        borderRadius="$m"
        enterStyle={{ y: -10, opacity: 0 }}
        exitStyle={{ y: -10, opacity: 0 }}
        elevate
        animation={[
          'quick',
          {
            opacity: {
              overshootClamping: true,
            },
          },
        ]}
      >
        <YStack gap="$s">
          <Popover.Close asChild>
            <ListItem
              title="Create or join a group"
              onPress={() => setAddGroupOpen(true)}
            />
          </Popover.Close>
          <Popover.Close asChild>
            <ListItem
              title="Start a direct message"
              onPress={() => setStartDmOpen(true)}
            />
          </Popover.Close>
        </YStack>
      </Popover.Content>
    </Popover>
  );
}
