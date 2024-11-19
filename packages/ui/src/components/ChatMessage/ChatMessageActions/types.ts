import { ChannelAction } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { RefObject } from 'react';
import { DimensionValue, View as RNView } from 'react-native';

export type ChatMessageActionsProps = {
  post: db.Post;
  postActionIds: ChannelAction.Id[];
  postRef?: RefObject<RNView>;
  onDismiss: () => void;
  width?: DimensionValue;
  height?: DimensionValue;
  onReply?: (post: db.Post) => void;
  onEdit?: () => void;
  onViewReactions?: (post: db.Post) => void;
};
