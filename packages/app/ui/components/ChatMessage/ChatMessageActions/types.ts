import { ChannelAction } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import React from 'react';
import { RefObject } from 'react';
import { DimensionValue, View as RNView } from 'react-native';

export type ChatMessageActionsProps = {
  post: db.Post;
  postActionIds: ChannelAction.Id[];
  postRef?: RefObject<RNView>;
  onDismiss: () => void;
  onOpenChange?: (open: boolean) => void;
  width?: DimensionValue;
  height?: DimensionValue;
  onReply?: (post: db.Post) => void;
  onEdit?: () => void;
  onViewReactions?: (post: db.Post) => void;
  onShowEmojiPicker?: () => void;
  trigger?: React.ReactNode;
  mode: 'await-trigger' | 'immediate';
};
