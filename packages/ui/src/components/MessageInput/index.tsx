import Blockquote from '@tiptap/extension-blockquote';
import Bold from '@tiptap/extension-bold';
import Code from '@tiptap/extension-code';
import CodeBlock from '@tiptap/extension-code-block';
import Document from '@tiptap/extension-document';
import HardBreak from '@tiptap/extension-hard-break';
import History from '@tiptap/extension-history';
import Italic from '@tiptap/extension-italic';
import Link from '@tiptap/extension-link';
import Paragraph from '@tiptap/extension-paragraph';
import Placeholder from '@tiptap/extension-placeholder';
import Strike from '@tiptap/extension-strike';
import Text from '@tiptap/extension-text';
import { EditorContent, useEditor } from '@tiptap/react';
import {
  REF_REGEX,
  createDevLogger,
  extractContentTypesFromPost,
  tiptap,
} from '@tloncorp/shared';
import {
  contentReferenceToCite,
  toContentReference,
} from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import {
  Block,
  Inline,
  Story,
  citeToPath,
  constructStory,
  isInline,
  pathToCite,
} from '@tloncorp/shared/urbit';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, YStack, getTokenValue, useWindowDimensions } from 'tamagui';

import {
  Attachment,
  UploadedImageAttachment,
  useAttachmentContext,
} from '../../contexts/attachment';
import { AttachmentPreviewList } from './AttachmentPreviewList';
import { MessageInputContainer, MessageInputProps } from './MessageInputBase';

export const DEFAULT_MESSAGE_INPUT_HEIGHT = 44;

const messageInputLogger = createDevLogger('MessageInput', false);

export function MessageInput({
  shouldBlur,
  setShouldBlur,
  send,
  channelId,
  groupMembers,
  storeDraft,
  clearDraft,
  getDraft,
  editingPost,
  setEditingPost,
  editPost,
  setShowBigInput,
  showInlineAttachments,
  showAttachmentButton,
  floatingActionButton,
  backgroundColor = '$background',
  paddingHorizontal,
  initialHeight = DEFAULT_MESSAGE_INPUT_HEIGHT,
  placeholder,
  bigInput = false,
  title,
  image,
  channelType,
  setHeight,
  goBack,
  onSend,
}: MessageInputProps) {
  const {
    attachments,
    addAttachment,
    clearAttachments,
    resetAttachments,
    waitForAttachmentUploads,
  } = useAttachmentContext();

  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [hasSetInitialContent, setHasSetInitialContent] = useState(false);
  const [editorIsEmpty, setEditorIsEmpty] = useState(attachments.length === 0);
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionText, setMentionText] = useState<string>();

  const { bottom, top } = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const headerHeight = 48;
  const titleInputHeight = 48;
  const inputBasePadding = getTokenValue('$s', 'space');
  const imageInputButtonHeight = 50;
  const basicOffset = useMemo(
    () => top + headerHeight + titleInputHeight + imageInputButtonHeight,
    [top, headerHeight, titleInputHeight, imageInputButtonHeight]
  );
  const bigInputHeightBasic = useMemo(
    () => height - basicOffset - bottom - inputBasePadding * 2,
    [height, basicOffset, bottom, inputBasePadding]
  );

  const extensions = [
    Blockquote,
    Bold,
    Code.extend({
      excludes: undefined,
      exitable: true,
    }).configure({
      HTMLAttributes: {
        class: 'rounded px-1 bg-gray-50 dark:bg-gray-100',
      },
    }),
    CodeBlock.configure({
      HTMLAttributes: {
        class: 'mr-4 px-2 rounded bg-gray-50 dark:bg-gray-100',
      },
    }),
    Document,
    HardBreak,
    History.configure({ newGroupDelay: 100 }),
    Italic,
    // keyMapExt,
    Link.configure({
      openOnClick: false,
    }).extend({
      exitable: true,
    }),
    Paragraph,
    Placeholder.configure({ placeholder: placeholder ?? 'Message' }),
    Strike,
    Text,
    // Text.extend({
    // addPasteRules() {
    // return [refPasteRule(onReference)];
    // },
    // }),
  ];

  const editor = useEditor(
    {
      extensions,
    },
    [placeholder]
  );

  // eslint-disable-next-line
  const json = editor?.getJSON() ?? {};

  useEffect(() => {
    if (!hasSetInitialContent && editor) {
      try {
        getDraft().then((draft) => {
          if (draft) {
            editor.commands.setContent(draft);
            setEditorIsEmpty(false);
          }
          if (editingPost?.content) {
            const {
              story,
              references: postReferences,
              blocks,
            } = extractContentTypesFromPost(editingPost);

            if (story === null && !postReferences && blocks.length === 0) {
              return;
            }

            const attachments: Attachment[] = [];

            postReferences.forEach((p) => {
              const cite = contentReferenceToCite(p);
              const path = citeToPath(cite);
              attachments.push({
                type: 'reference',
                reference: p,
                path,
              });
            });

            blocks.forEach((b) => {
              if ('image' in b) {
                attachments.push({
                  type: 'image',
                  file: {
                    uri: b.image.src,
                    height: b.image.height,
                    width: b.image.width,
                  },
                });
              }
            });

            resetAttachments(attachments);

            if (story === null) {
              return;
            }

            const tiptapContent = tiptap.diaryMixedToJSON(
              story.filter(
                (c) => !('type' in c) && !('block' in c && 'image' in c.block)
              ) as Story
            );
            editor.commands.setContent(tiptapContent);

            if (editingPost.image) {
              addAttachment({
                type: 'image',
                file: {
                  uri: editingPost.image,
                  height: 0,
                  width: 0,
                },
              });
            }
          }
        });
      } catch (e) {
        messageInputLogger.error('Error getting draft', e);
      } finally {
        setHasSetInitialContent(true);
      }
    }
  }, [
    editor,
    getDraft,
    hasSetInitialContent,
    editingPost,
    resetAttachments,
    addAttachment,
  ]);

  useEffect(() => {
    if (editor && shouldBlur && editor.isFocused) {
      editor.commands.blur();
      setShouldBlur(false);
    }
  }, [shouldBlur, editor, setShouldBlur]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const inlines = tiptap
      .JSONToInlines(json)
      .filter(
        (c) => typeof c === 'string' || (typeof c === 'object' && isInline(c))
      ) as Inline[];
    const blocks =
      tiptap
        .JSONToInlines(json)
        .filter((c) => typeof c !== 'string' && 'block' in c) || [];

    const inlineIsJustBreak = !!(
      inlines.length === 1 &&
      inlines[0] &&
      typeof inlines[0] === 'object' &&
      'break' in inlines[0]
    );

    const isEmpty =
      (inlines.length === 0 || inlineIsJustBreak) &&
      blocks.length === 0 &&
      attachments.length === 0;

    if (isEmpty !== editorIsEmpty) {
      setEditorIsEmpty(isEmpty);
    }
  }, [json, editor, attachments, editorIsEmpty]);

  editor?.on('update', () => {
    const inlines = (
      tiptap
        .JSONToInlines(json)
        .filter(
          (c) => typeof c === 'string' || (typeof c === 'object' && isInline(c))
        ) as Inline[]
    ).filter((inline) => inline !== null) as Inline[];
    // find the first mention in the inlines without refs
    const mentionInline = inlines.find(
      (inline) => typeof inline === 'string' && inline.match(/\B[~@]/)
    ) as string | undefined;
    // extract the mention text from the mention inline
    const mentionText = mentionInline
      ? mentionInline.slice((mentionInline.match(/\B[~@]/)?.index ?? -1) + 1)
      : null;
    if (mentionText !== null) {
      // if we have a mention text, we show the mention popup
      setShowMentionPopup(true);
      setMentionText(mentionText);
    } else {
      setShowMentionPopup(false);
    }

    storeDraft(json);
  });

  // TODO: Looks like paste isn't handled on web yet? When adding support, check
  // against the corresponding native implementaion
  const handlePaste = useCallback(
    async (pastedText: string) => {
      if (!editor) {
        return;
      }
      if (pastedText) {
        const isRef = pastedText.match(REF_REGEX);

        if (isRef) {
          const cite = pathToCite(isRef[0]);

          if (cite) {
            const reference = toContentReference(cite);
            if (reference) {
              addAttachment({
                type: 'reference',
                reference,
                path: isRef[0],
              });
            }

            const inlines = tiptap
              .JSONToInlines(json)
              .filter(
                (c) =>
                  typeof c === 'string' ||
                  (typeof c === 'object' && isInline(c))
              ) as Inline[];
            const blocks =
              tiptap
                .JSONToInlines(json)
                .filter((c) => typeof c !== 'string' && 'block' in c) || [];

            // then we need to find all the inlines without refs
            // so we can render the input text without refs
            const inlinesWithOutRefs = inlines
              .map((inline) => {
                if (typeof inline === 'string') {
                  const inlineLength = inline.length;
                  const refLength = inline.match(REF_REGEX)?.[0].length || 0;

                  if (inlineLength === refLength) {
                    return null;
                  }

                  return inline.replace(REF_REGEX, '');
                }
                return inline;
              })
              .filter((inline) => inline !== null) as string[];

            // we construct a story here so we can insert blocks back in
            // and then convert it back to tiptap's JSON format
            const newStory = constructStory(inlinesWithOutRefs);

            if (blocks && blocks.length > 0) {
              newStory.push(
                ...blocks.map((block) => ({
                  block: block as unknown as Block,
                }))
              );
            }

            const newJson = tiptap.diaryMixedToJSON(newStory);

            editor.commands.setContent(newJson);
          }
        }
      }
    },
    [json, editor, addAttachment]
  );

  const onSelectMention = useCallback(
    async (contact: db.Contact) => {
      if (!editor) {
        return;
      }
      const inlines = tiptap.JSONToInlines(json);

      let textBeforeSig = '';
      let textBeforeAt = '';

      const newInlines = inlines.map((inline) => {
        if (typeof inline === 'string') {
          if (inline.match(`~`)) {
            textBeforeSig = inline.split('~')[0];

            return {
              ship: contact.id,
            };
          }

          if (inline.match(`@`)) {
            textBeforeAt = inline.split('@')[0];
            return {
              ship: contact.id,
            };
          }

          return inline;
        }
        return inline;
      });

      if (textBeforeSig) {
        const indexOfMention = newInlines.findIndex(
          (inline) =>
            typeof inline === 'object' &&
            'ship' in inline &&
            inline.ship === contact.id
        );

        newInlines.splice(indexOfMention, 0, textBeforeSig);
      }

      if (textBeforeAt) {
        const indexOfMention = newInlines.findIndex(
          (inline) =>
            typeof inline === 'object' &&
            'ship' in inline &&
            inline.ship === contact.id
        );

        newInlines.splice(indexOfMention, 0, textBeforeAt);
      }

      const newStory = constructStory(newInlines);

      const newJson = tiptap.diaryMixedToJSON(newStory);

      editor.commands.setContent(newJson);
      storeDraft(newJson);
      setMentionText('');
      setShowMentionPopup(false);
    },
    [json, editor, storeDraft]
  );

  const sendMessage = useCallback(
    async (isEdit?: boolean) => {
      if (!editor) {
        return;
      }

      const inlines = tiptap.JSONToInlines(json);
      const story = constructStory(inlines);

      const finalAttachments = await waitForAttachmentUploads();

      const blocks = finalAttachments.flatMap((attachment): Block[] => {
        if (attachment.type === 'reference') {
          const cite = pathToCite(attachment.path);
          return cite ? [{ cite }] : [];
        }
        if (
          attachment.type === 'image' &&
          (!image || attachment.file.uri !== image?.uri)
        ) {
          return [
            {
              image: {
                src: attachment.uploadState.remoteUri,
                height: attachment.file.height,
                width: attachment.file.width,
                alt: 'image',
              },
            },
          ];
        }
        return [];
      });

      if (blocks && blocks.length > 0) {
        if (channelType === 'chat') {
          story.unshift(...blocks.map((block) => ({ block })));
        } else {
          story.push(...blocks.map((block) => ({ block })));
        }
      }

      const metadata: db.PostMetadata = {};
      if (title && title.length > 0) {
        metadata['title'] = title;
      }

      if (image) {
        const attachment = finalAttachments.find(
          (a): a is UploadedImageAttachment =>
            a.type === 'image' && a.file.uri === image.uri
        );
        if (!attachment) {
          throw new Error('unable to attach image');
        }
        metadata['image'] = attachment.uploadState.remoteUri;
      }

      if (isEdit && editingPost) {
        if (editingPost.parentId) {
          await editPost?.(editingPost, story, editingPost.parentId, metadata);
        }
        await editPost?.(editingPost, story, undefined, metadata);
        setEditingPost?.(undefined);
      } else {
        const metadata: db.PostMetadata = {};
        if (title && title.length > 0) {
          metadata['title'] = title;
        }

        if (image) {
          const attachment = finalAttachments.find(
            (a): a is UploadedImageAttachment =>
              a.type === 'image' && a.file.uri === image.uri
          );
          if (!attachment) {
            throw new Error('unable to attach image');
          }
          metadata['image'] = attachment.uploadState.remoteUri;
        }

        // not awaiting since we don't want to wait for the send to complete
        // before clearing the draft and the editor content
        send(story, channelId, metadata);
      }

      onSend?.();
      editor.commands.clearContent();
      clearAttachments();
      clearDraft();
      setShowBigInput?.(false);
    },
    [
      json,
      onSend,
      editor,
      waitForAttachmentUploads,
      editingPost,
      clearAttachments,
      clearDraft,
      setShowBigInput,
      editPost,
      setEditingPost,
      title,
      image,
      channelType,
      send,
      channelId,
    ]
  );

  const runSendMessage = useCallback(
    async (isEdit: boolean) => {
      setIsSending(true);
      try {
        await sendMessage(isEdit);
      } catch (e) {
        console.error('failed to send', e);
        setSendError(true);
      }
      setIsSending(false);
      setSendError(false);
    },
    [sendMessage]
  );

  const handleSend = useCallback(async () => {
    Keyboard.dismiss();
    runSendMessage(false);
  }, [runSendMessage]);

  const handleEdit = useCallback(async () => {
    Keyboard.dismiss();
    if (!editingPost) {
      return;
    }
    runSendMessage(true);
  }, [runSendMessage, editingPost]);

  const titleIsEmpty = useMemo(() => !title || title.length === 0, [title]);

  return (
    <MessageInputContainer
      setShouldBlur={setShouldBlur}
      onPressSend={handleSend}
      onPressEdit={handleEdit}
      containerHeight={initialHeight}
      mentionText={mentionText}
      groupMembers={groupMembers}
      onSelectMention={onSelectMention}
      showMentionPopup={showMentionPopup}
      isEditing={!!editingPost}
      isSending={isSending}
      sendError={sendError}
      cancelEditing={() => setEditingPost?.(undefined)}
      showAttachmentButton={showAttachmentButton}
      floatingActionButton={floatingActionButton}
      disableSend={
        editorIsEmpty || (channelType === 'notebook' && titleIsEmpty)
      }
      goBack={goBack}
    >
      <YStack
        flex={1}
        backgroundColor={backgroundColor}
        paddingHorizontal={paddingHorizontal}
        borderColor="$border"
        borderWidth={1}
        borderRadius="$xl"
      >
        {showInlineAttachments && <AttachmentPreviewList />}
        <View height={bigInput ? bigInputHeightBasic : initialHeight} width="80%">
          <EditorContent
            style={{
              width: '100%',
              height: '100%',
              padding: 12,
            }}
            editor={editor}
          />
        </View>
      </YStack>
    </MessageInputContainer>
  );
}
