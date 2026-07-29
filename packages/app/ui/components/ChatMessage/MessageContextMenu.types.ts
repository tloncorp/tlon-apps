import { ChannelAction } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { ReactNode } from 'react';

export interface MessageContextMenuProps {
  children: ReactNode;
  enabled: boolean;
  post: db.Post;
  postActionIds: ChannelAction.Id[];
  canReact: boolean;
  onReply?: (post: db.Post) => void;
  onEdit?: () => void;
  onViewReactions?: (post: db.Post) => void;
  onViewBotRun?: (post: db.Post) => void;
  onShowEmojiPicker?: () => void;
}
