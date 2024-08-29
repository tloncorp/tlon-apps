import * as db from '@tloncorp/shared/dist/db';
import { ScrollView, SizableText } from 'tamagui';

import { useCurrentUserId } from '../../contexts/appDataContext';
import { useReactionDetails } from '../../utils/postUtils';
import ContactName from '../ContactName';
import { getNativeEmoji } from '../Emoji';
import { ListItem } from '../ListItem';
import { Sheet, SheetHeader } from '../Sheet';
import { Emoji } from '../TrimmedText';
import { ViewReactionsPane } from './ViewReactionsPane';

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
      snapPointsMode="percent"
      snapPoints={[60]}
    >
      <Sheet.LazyFrame padding="$l">
        <Sheet.Overlay />
        <SheetHeader>
          <SheetHeader.Title>
            <SizableText>Reactions</SizableText>
          </SheetHeader.Title>
        </SheetHeader>
        <ViewReactionsPane post={post} />
      </Sheet.LazyFrame>
    </Sheet>
  );
}
