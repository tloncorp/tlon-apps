import { ChannelAction } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import React from 'react';
import { RefObject } from 'react';
import { ViewInstance } from 'react-native';
import { ViewProps } from 'tamagui';

export type ChatMessageActionsProps = {
  post: db.Post;
  postActionIds: ChannelAction.Id[];
  postRef?: RefObject<ViewInstance | null>;
  onDismiss: () => void;
  onOpenChange?: (open: boolean) => void;
  width?: ViewProps['width'];
  height?: ViewProps['height'];
  onReply?: (post: db.Post) => void;
  onEdit?: () => void;
  onViewReactions?: (post: db.Post) => void;
  onViewBotRun?: (post: db.Post) => void;
  onShowEmojiPicker?: () => void;
  trigger?: React.ReactNode;
  mode: 'await-trigger' | 'immediate';
};
