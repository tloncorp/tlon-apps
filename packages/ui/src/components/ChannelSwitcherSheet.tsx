import * as db from '@tloncorp/shared/dist/db';

import { ContactsProvider } from '../contexts';
import { SizableText, View } from '../core';
import ChannelNavSections from './ChannelNavSections';
import { Sheet } from './Sheet';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: db.GroupWithRelations;
  channels: db.ChannelWithLastPost[];
  contacts: db.Contact[];
  onSelect: (channel: db.Channel) => void;
}

export function ChannelSwitcherSheet({
  open,
  onOpenChange,
  group,
  channels,
  onSelect,
  contacts,
}: Props) {
  return (
    <ContactsProvider initialContacts={contacts}>
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
            paddingHorizontal="$xl"
            paddingTop="$xl"
            paddingBottom="$4xl"
          >
            <SizableText
              fontSize="$l"
              fontWeight="500"
              color="$primaryText"
              paddingHorizontal="$l"
            >
              {group?.title}
            </SizableText>
            <ChannelNavSections
              group={group}
              channels={channels}
              onSelect={onSelect}
            />
          </View>
        </Sheet.Frame>
      </Sheet>
    </ContactsProvider>
  );
}
