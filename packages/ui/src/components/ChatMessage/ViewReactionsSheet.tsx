import * as db from '@tloncorp/shared/dist/db';
import { ScrollView, SizableText } from 'tamagui';

import { useCurrentUserId } from '../../contexts/appDataContext';
import { useReactionDetails } from '../../utils/postUtils';
import ContactName from '../ContactName';
import { getNativeEmoji } from '../Emoji';
import { ListItem } from '../ListItem';
import { Sheet, SheetHeader } from '../Sheet';
import { Emoji } from '../TrimmedText';

export function ViewReactionsSheet({
  post,
  open,
  onOpenChange,
}: {
  post: db.Post;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const currentUserId = useCurrentUserId();
  const details = useReactionDetails(post.reactions ?? [], currentUserId);

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={onOpenChange}
      animation="quick"
      dismissOnSnapToBottom
    >
      <Sheet.LazyFrame padding="$l">
        <Sheet.Overlay />
        <SheetHeader>
          <SheetHeader.Title>
            <SizableText>Reactions</SizableText>
          </SheetHeader.Title>
        </SheetHeader>
        <ScrollView>
          {details.list.map((reaction) => (
            <ListItem key={reaction.users[0]}>
              <Emoji size="$m">{getNativeEmoji(reaction.value)}</Emoji>
              <ListItem.EndContent>
                <ContactName userId={reaction.users[0]} showNickname flex={1} />
              </ListItem.EndContent>
            </ListItem>
          ))}
        </ScrollView>
      </Sheet.LazyFrame>
    </Sheet>
  );
}
