import * as db from '@tloncorp/shared/dist/db';
import { useEffect, useState } from 'react';

import { ContactsProvider } from '../contexts';
import { SizableText } from '../core';
import ChannelNavSections from './ChannelNavSections';
import { Sheet } from './Sheet';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: db.GroupWithRelations;
  channels: db.ChannelWithLastPostAndMembers[];
  contacts: db.Contact[];
  onSelect: (channel: db.ChannelWithLastPostAndMembers) => void;
  paddingBottom?: number;
}

export function ChannelSwitcherSheet({
  open,
  onOpenChange,
  group,
  channels,
  onSelect,
  contacts,
  paddingBottom,
}: Props) {
  const [hasOpened, setHasOpened] = useState(open);
  useEffect(() => {
    setHasOpened(open);
  }, [open]);
  return (
    <ContactsProvider contacts={contacts}>
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        modal
        dismissOnSnapToBottom
        snapPointsMode="percent"
        snapPoints={[90]}
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
          <Sheet.ScrollView gap="$xl" paddingHorizontal="$xl" paddingTop="$xl">
            <SizableText
              fontSize="$l"
              fontWeight="500"
              color="$primaryText"
              paddingHorizontal="$l"
            >
              {group?.title}
            </SizableText>
            {hasOpened && (
              <ChannelNavSections
                group={group}
                channels={channels}
                onSelect={onSelect}
                paddingBottom={paddingBottom}
              />
            )}
          </Sheet.ScrollView>
        </Sheet.Frame>
      </Sheet>
    </ContactsProvider>
  );
}
