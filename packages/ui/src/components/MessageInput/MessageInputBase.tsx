import {
  ContentReference as ContentReferenceType,
  Upload,
} from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import { JSONContent, Story } from '@tloncorp/shared/dist/urbit';
import { PropsWithChildren, useMemo } from 'react';

import { ArrowUp, Close } from '../../assets/icons';
import { useReferences } from '../../contexts/references';
import { View, XStack, YStack } from '../../core';
import ContentReference from '../ContentReference';
import { IconButton } from '../IconButton';
import AttachmentButton from './AttachmentButton';
import MentionPopup from './MentionPopup';

export interface MessageInputProps {
  shouldBlur: boolean;
  setShouldBlur: (shouldBlur: boolean) => void;
  send: (content: Story, channelId: string) => void;
  channelId: string;
  setImageAttachment: (image: string | null) => void;
  uploadedImage?: Upload | null;
  canUpload?: boolean;
  groupMembers: db.ChatMember[];
  storeDraft: (draft: JSONContent) => void;
  clearDraft: () => void;
  getDraft: () => Promise<JSONContent>;
}

export const MessageInputContainer = ({
  children,
  onPressSend,
  setImageAttachment,
  uploadedImage,
  canUpload,
  containerHeight,
  showMentionPopup = false,
  mentionText,
  groupMembers,
  onSelectMention,
}: PropsWithChildren<{
  onPressSend?: () => void;
  setImageAttachment: (image: string | null) => void;
  uploadedImage?: Upload | null;
  canUpload?: boolean;
  containerHeight: number;
  showMentionPopup?: boolean;
  mentionText?: string;
  groupMembers: db.ChatMember[];
  onSelectMention: (contact: db.Contact) => void;
}>) => {
  const { references, setReferences } = useReferences();
  const hasUploadedImage = useMemo(
    () => !!(uploadedImage && uploadedImage.url !== ''),
    [uploadedImage]
  );
  const uploadIsLoading = useMemo(
    () => uploadedImage?.status === 'loading',
    [uploadedImage]
  );
  const sendIconColor = useMemo(
    () => (uploadIsLoading ? '$secondaryText' : '$primaryText'),
    [uploadIsLoading]
  );

  return (
    <YStack width="100%">
      {Object.keys(references).length ? (
        <YStack
          gap="$s"
          width="100%"
          position="absolute"
          bottom={containerHeight + 4}
          zIndex={10}
          backgroundColor="$background"
        >
          {Object.keys(references).map((ref) =>
            references[ref] !== null ? (
              <XStack
                left={20}
                position="relative"
                key={ref}
                width="100%"
                height="auto"
              >
                <ContentReference
                  asAttachment
                  reference={references[ref]!}
                  key={ref}
                />
                <View position="absolute" top={8} right={48}>
                  <IconButton
                    onPress={() => {
                      setReferences({ ...references, [ref]: null });
                    }}
                    color="$secondaryText"
                  >
                    <Close />
                  </IconButton>
                </View>
              </XStack>
            ) : null
          )}
        </YStack>
      ) : null}
      {showMentionPopup ? (
        <YStack position="absolute" bottom={containerHeight + 4} zIndex={15}>
          <View position="relative" top={0} left={8}>
            <MentionPopup
              onPress={onSelectMention}
              matchText={mentionText}
              groupMembers={groupMembers}
            />
          </View>
        </YStack>
      ) : null}
      <XStack
        paddingHorizontal="$m"
        paddingVertical="$s"
        gap="$l"
        alignItems="flex-end"
        justifyContent="space-between"
      >
        {hasUploadedImage ? null : canUpload ? (
          <View paddingBottom="$m">
            <AttachmentButton
              uploadedImage={uploadedImage}
              setImage={setImageAttachment}
            />
          </View>
        ) : null}
        {children}
        <View paddingBottom="$m">
          <IconButton
            color={sendIconColor}
            disabled={uploadIsLoading}
            onPress={onPressSend}
          >
            {/* TODO: figure out what send button should look like */}
            <ArrowUp />
          </IconButton>
        </View>
      </XStack>
    </YStack>
  );
};
