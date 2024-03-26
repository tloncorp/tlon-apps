import { Sheet } from './Sheet';
import { Stack, View, Text, SizableText } from '../core';
import { ClientTypes } from '@tloncorp/shared';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: ClientTypes.Group;
}

export function GroupOptionsSheet({ open, onOpenChange, group }: Props) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      modal
      dismissOnSnapToBottom
      snapPointsMode="fit"
      // TODO: Figure out why typescript is complaining about the animation prop
      // @ts-ignore - animation prop is not recognized
      animation="quick"
    >
      <Sheet.Overlay
        // TODO: Figure out why typescript is complaining about the animation prop
        // @ts-ignore - animation prop is not recognized
        animation="quick"
      />
      <Sheet.Frame>
        <Sheet.Handle paddingTop="$xl" />
        <View
          gap="$xl"
          paddingHorizontal="$2xl"
          paddingTop="$xl"
          paddingBottom="$4xl"
        >
          <Stack paddingBottom="$m" flexDirection="column">
            {/* TODO: Convert all of these Text components to SizableText */}
            <Text fontSize="$l" fontWeight="500">
              {group?.title}
            </Text>
            <Text fontSize="$l" color="$secondaryText">
              Quick actions
            </Text>
          </Stack>

          <Stack
            padding="$l"
            backgroundColor="$greenSoft"
            borderWidth={1}
            borderColor="$green"
            borderRadius="$l"
          >
            <Text fontSize="$l" color="$green" fontWeight="500">
              Connected
            </Text>
          </Stack>

          <Stack
            padding="$l"
            borderWidth={1}
            borderColor="$blueSoft"
            borderRadius="$l"
          >
            <Text fontSize="$l" color="$blue" fontWeight="500">
              Invite People
            </Text>
          </Stack>

          <Stack
            padding="$l"
            borderWidth={1}
            borderColor="rgb(229, 229, 229)"
            borderRadius="$l"
          >
            <Text fontSize="$l" fontWeight="500">
              Group settings
            </Text>
            <Text color="$secondaryText" fontSize="$s">
              Configure group details and privacy
            </Text>
          </Stack>

          <Stack
            borderWidth={1}
            borderColor="rgb(229, 229, 229)"
            borderRadius="$l"
          >
            <Stack
              padding="$l"
              borderBottomWidth={1}
              borderBottomColor="rgb(229, 229, 229)"
            >
              <Text fontSize="$l" fontWeight="500">
                {group?.pinIndex !== null ? 'Unpin' : 'Pin'}
              </Text>
              <Text color="$secondaryText" fontSize="$s">
                {group?.pinIndex !== null ? 'Unpin' : 'Pin'} this group{' '}
                {group?.pinIndex !== null ? 'from' : 'to'} the top of your
                Groups list
              </Text>
            </Stack>

            <Stack
              padding="$l"
              borderBottomWidth={1}
              borderBottomColor="rgb(229, 229, 229)"
            >
              <Text fontSize="$l" fontWeight="500">
                Copy group reference
              </Text>
              <Text color="$secondaryText" fontSize="$s">
                Copy an in-Urbit link to this group
              </Text>
            </Stack>

            <Stack
              padding="$l"
              borderBottomWidth={1}
              borderBottomColor="rgb(229, 229, 229)"
            >
              <Text fontSize="$l" fontWeight="500">
                Group members
              </Text>
              <Text color="$secondaryText" fontSize="$s">
                View all members and roles
              </Text>
            </Stack>

            <Stack
              padding="$l"
              borderBottomWidth={1}
              borderBottomColor="rgb(229, 229, 229)"
            >
              <Text fontSize="$l" fontWeight="500">
                Channels
              </Text>
              <Text color="$secondaryText" fontSize="$s">
                View all channels you have access to
              </Text>
            </Stack>

            <Stack padding="$l">
              <Text fontSize="$l" fontWeight="500">
                Group notification settings
              </Text>
              <Text color="$secondaryText" fontSize="$s">
                Configure your notifications for this group
              </Text>
            </Stack>
          </Stack>
        </View>
      </Sheet.Frame>
    </Sheet>
  );
}
