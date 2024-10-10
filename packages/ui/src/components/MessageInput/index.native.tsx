import {
  BridgeExtension,
  EditorBridge,
  EditorMessage,
  PlaceholderBridge,
  RichText,
  TenTapStartKit,
  useBridgeState,
  useEditorBridge,
} from '@10play/tentap-editor';
//ts-expect-error not typed
import { editorHtml } from '@tloncorp/editor/dist/editorHtml';
import {
  CodeBlockBridge,
  MentionsBridge,
  ShortcutsBridge,
} from '@tloncorp/editor/src/bridges';
import {
  createDevLogger,
  extractContentTypesFromPost,
  tiptap,
} from '@tloncorp/shared/dist';
import {
  contentReferenceToCite,
  toContentReference,
} from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import {
  Block,
  Inline,
  JSONContent,
  Story,
  citeToPath,
  constructStory,
  isInline,
  pathToCite,
} from '@tloncorp/shared/dist/urbit';
import * as logic from '@tloncorp/shared/src/logic';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { WebViewMessageEvent } from 'react-native-webview';
import { YStack, getToken, useWindowDimensions } from 'tamagui';
import { XStack } from 'tamagui';

import { useBranchDomain, useBranchKey } from '../../contexts';
import {
  Attachment,
  UploadedImageAttachment,
  useAttachmentContext,
} from '../../contexts/attachment';
import { AttachmentPreviewList } from './AttachmentPreviewList';
import { MessageInputContainer, MessageInputProps } from './MessageInputBase';
import { processReferenceAndUpdateEditor } from './helpers';

const messageInputLogger = createDevLogger('MessageInput', false);

type MessageEditorMessage = {
  type: 'contentHeight';
  payload: number;
} & EditorMessage;

// This function and the one below it are taken from RichText.tsx
// in the tentap-editor package.
// We need this because we're overriding the injectedJavaScript prop
// in the RichText component, and we need to make sure that the
// bridge extension CSS is injected into the WebView.
export const getStyleSheetCSS = (css: string, styleSheetTag: string) => {
  return `
    cssContent = \`${css}\`;
    head = document.head || document.getElementsByTagName('head')[0],
    styleElement = head.querySelector('style[data-tag="${styleSheetTag}"]');

    if (!styleElement) {
      // If no such element exists, create a new <style> element.
      styleElement = document.createElement('style');
      styleElement.setAttribute('data-tag', '${styleSheetTag}'); // Assign the unique 'data-tag' attribute.
      styleElement.type = 'text/css'; // Specify the type attribute for clarity.
      head.appendChild(styleElement); // Append the newly created <style> element to the <head>.
    }

    styleElement.innerHTML = cssContent;
    `;
};

const getInjectedJS = (bridgeExtensions: BridgeExtension[]) => {
  let injectJS = '';
  // For each bridge extension, we create a stylesheet with it's name as the tag
  const styleSheets = bridgeExtensions.map(({ extendCSS, name }) =>
    getStyleSheetCSS(extendCSS || '', name)
  );
  injectJS += styleSheets.join(' ');
  return injectJS;
};

// 44 accounts for the 12px padding around the text within the input
// and the 20px line height of the text. 12 + 20 + 12 = 52
export const DEFAULT_MESSAGE_INPUT_HEIGHT = 44;

export interface MessageInputHandle {
  editor: EditorBridge | null;
  setEditor: (editor: EditorBridge) => void;
}

export const MessageInput = forwardRef<MessageInputHandle, MessageInputProps>(
  (
    {
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
      showInlineAttachments = true,
      showAttachmentButton = true,
      floatingActionButton = false,
      backgroundColor = '$background',
      paddingHorizontal,
      initialHeight = DEFAULT_MESSAGE_INPUT_HEIGHT,
      placeholder = 'Message',
      bigInput = false,
      draftType,
      title,
      image,
      channelType,
      setHeight,
      goBack,
      onSend,
    },
    ref
  ) => {
    const localEditorRef = useRef<EditorBridge | null>(null);

    useImperativeHandle(ref, () => ({
      editor: localEditorRef.current,
      setEditor: (editor: EditorBridge) => {
        localEditorRef.current = editor;
      },
    }));

    const branchDomain = useBranchDomain();
    const branchKey = useBranchKey();
    const [isSending, setIsSending] = useState(false);
    const [hasSetInitialContent, setHasSetInitialContent] = useState(false);
    const [editorCrashed, setEditorCrashed] = useState<string | undefined>();
    const [containerHeight, setContainerHeight] = useState(initialHeight);
    const { bottom, top } = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const headerHeight = 48;
    const titleInputHeight = 48;
    const inputBasePadding = getToken('$s', 'space');
    const imageInputButtonHeight = 50;
    const maxInputHeightBasic = useMemo(
      () => height - headerHeight - bottom - top,
      [height, bottom, top, headerHeight]
    );
    const basicOffset = useMemo(
      () => top + headerHeight + titleInputHeight + imageInputButtonHeight,
      [top, headerHeight, titleInputHeight, imageInputButtonHeight]
    );
    const bigInputHeightBasic = useMemo(
      () => height - basicOffset - bottom - inputBasePadding * 2,
      [height, basicOffset, bottom, inputBasePadding]
    );
    const [bigInputHeight, setBigInputHeight] = useState(bigInputHeightBasic);
    const [maxInputHeight, setMaxInputHeight] = useState(maxInputHeightBasic);
    const [mentionText, setMentionText] = useState<string>();
    const [showMentionPopup, setShowMentionPopup] = useState(false);

    const {
      attachments,
      addAttachment,
      clearAttachments,
      resetAttachments,
      waitForAttachmentUploads,
    } = useAttachmentContext();

    const [editorIsEmpty, setEditorIsEmpty] = useState(
      attachments.length === 0
    );

    const bridgeExtensions = [
      ...TenTapStartKit,
      MentionsBridge,
      ShortcutsBridge,
      CodeBlockBridge,
    ];

    if (placeholder) {
      bridgeExtensions.push(
        PlaceholderBridge.configureExtension({
          placeholder,
        })
      );
    }

    const editor = useEditorBridge({
      customSource: editorHtml,
      // setting autofocus to true if we have editPost here doesn't seem to work
      // so we're using a useEffect to set it
      autofocus: false,
      bridgeExtensions,
    });
    const editorState = useBridgeState(editor);
    const webviewRef = editor.webviewRef;

    const reloadWebview = useCallback(
      (reason: string) => {
        webviewRef.current?.reload();
        messageInputLogger.log('[webview] Reloading webview, reason:', reason);
        setEditorCrashed(undefined);
      },
      [webviewRef]
    );

    useEffect(() => {
      if (editor) {
        localEditorRef.current = editor;
      }

      if (ref && typeof ref === 'object' && ref.current) {
        ref.current.setEditor(editor);
      }
    }, [editor, ref]);

    const lastEditingPost = useRef<db.Post | undefined>(editingPost);

    useEffect(() => {
      if (!hasSetInitialContent && editorState.isReady) {
        try {
          getDraft(draftType).then((draft) => {
            if (!editingPost && draft) {
              const inlines = tiptap.JSONToInlines(draft);
              const newInlines = inlines
                .map((inline) => {
                  if (typeof inline === 'string') {
                    if (inline.match(tiptap.REF_REGEX)) {
                      return null;
                    }
                    return inline;
                  }
                  return inline;
                })
                .filter((inline) => inline !== null) as Inline[];
              const newStory = constructStory(newInlines);
              const tiptapContent = tiptap.diaryMixedToJSON(newStory);
              messageInputLogger.log('Setting draft content', tiptapContent);
              // @ts-expect-error setContent does accept JSONContent
              editor.setContent(tiptapContent);
              setEditorIsEmpty(false);
            }

            if (editingPost && editingPost.content) {
              messageInputLogger.log('Editing post', editingPost);
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

              const tiptapContent = tiptap.diaryMixedToJSON(
                story?.filter(
                  (c) => !('type' in c) && !('block' in c && 'image' in c.block)
                ) as Story
              );
              messageInputLogger.log(
                'Setting edit post content',
                tiptapContent
              );
              // @ts-expect-error setContent does accept JSONContent
              editor.setContent(tiptapContent);
              setEditorIsEmpty(false);
            }

            if (editingPost?.image) {
              addAttachment({
                type: 'image',
                file: {
                  uri: editingPost.image,
                  height: 0,
                  width: 0,
                },
              });
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
      draftType,
      hasSetInitialContent,
      editorState.isReady,
      editingPost,
      resetAttachments,
      addAttachment,
    ]);

    useEffect(() => {
      if (editingPost && lastEditingPost.current?.id !== editingPost.id) {
        messageInputLogger.log('Editing post changed', editingPost);
        lastEditingPost.current = editingPost;
        setHasSetInitialContent(false);
      }
    }, [editingPost]);

    useEffect(() => {
      if (editor && !shouldBlur && !editorState.isFocused && !!editingPost) {
        editor.focus();
      }
    }, [shouldBlur, editor, editorState, editingPost]);

    useEffect(() => {
      if (editor && shouldBlur && editorState.isFocused) {
        editor.blur();
        setShouldBlur(false);
      }
    }, [shouldBlur, editor, editorState, setShouldBlur]);

    useEffect(() => {
      messageInputLogger.log('Checking if editor is empty');

      editor.getJSON().then((json: JSONContent) => {
        const inlines = tiptap
          .JSONToInlines(json)
          .filter(
            (c) =>
              typeof c === 'string' || (typeof c === 'object' && isInline(c))
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

        messageInputLogger.log('Editor is empty?', isEmpty);

        if (isEmpty !== editorIsEmpty) {
          messageInputLogger.log('Setting editorIsEmpty', isEmpty);
          setEditorIsEmpty(isEmpty);
          setContainerHeight(initialHeight);
        }
      });
    }, [editor, attachments, editorIsEmpty, initialHeight]);

    editor._onContentUpdate = async () => {
      messageInputLogger.log(
        'Content updated, update draft and check for mention text'
      );

      const json = await editor.getJSON();
      const inlines = (
        tiptap
          .JSONToInlines(json)
          .filter(
            (c) =>
              typeof c === 'string' || (typeof c === 'object' && isInline(c))
          ) as Inline[]
      ).filter((inline) => inline !== null) as Inline[];
      // find the first mention in the inlines without refs
      const mentionInline = inlines.find(
        (inline) => typeof inline === 'string' && inline.match(/\B[~@]/)
      ) as string | undefined;
      // extract the mention text from the mention inline
      const mentionTextFromInline = mentionInline
        ? mentionInline.slice((mentionInline.match(/\B[~@]/)?.index ?? -1) + 1)
        : null;
      if (mentionTextFromInline !== null) {
        messageInputLogger.log('Mention text', mentionTextFromInline);
        // if we have a mention text, we show the mention popup
        setShowMentionPopup(true);
        setMentionText(mentionTextFromInline);
      } else {
        setShowMentionPopup(false);
        setMentionText('');
      }

      messageInputLogger.log('Storing draft', json);

      storeDraft(json, draftType);
    };

    const handlePaste = useCallback(
      async (pastedText: string) => {
        messageInputLogger.log('Pasted text', pastedText);
        // check for ref from pasted cite paths
        const editorJson = await editor.getJSON();
        const citePathAttachment = await processReferenceAndUpdateEditor({
          editor,
          editorJson,
          pastedText,
          matchRegex: tiptap.REF_REGEX,
          processMatch: async (match) => {
            const cite = pathToCite(match);
            if (cite) {
              const reference = toContentReference(cite);
              return reference
                ? { type: 'reference', reference, path: match }
                : null;
            }
            return null;
          },
        });
        if (citePathAttachment) {
          addAttachment(citePathAttachment);
        }

        // check for refs from pasted deeplinks
        const DEEPLINK_REGEX = new RegExp(`^(https?://)?${branchDomain}/\\S+$`);
        const deepLinkAttachment = await processReferenceAndUpdateEditor({
          editor,
          editorJson,
          pastedText,
          matchRegex: DEEPLINK_REGEX,
          processMatch: async (deeplink) => {
            const deeplinkRef = await logic.getReferenceFromDeeplink(
              deeplink,
              branchKey
            );
            return deeplinkRef
              ? {
                  type: 'reference',
                  reference: deeplinkRef.reference,
                  path: deeplinkRef.path,
                }
              : null;
          },
        });
        if (deepLinkAttachment) {
          addAttachment(deepLinkAttachment);
        }

        // check for refs from pasted lure links (after fallback redirect)
        const TLON_LURE_REGEX =
          /^(https?:\/\/)?(tlon\.network\/lure\/)(0v[^/]+)$/;
        const lureLinkAttachment = await processReferenceAndUpdateEditor({
          editor,
          editorJson,
          pastedText,
          matchRegex: TLON_LURE_REGEX,
          processMatch: async (tlonLure) => {
            const parts = tlonLure.split('/');
            const token = parts[parts.length - 1];
            if (!token) return null;
            const deeplinkRef = await logic.getReferenceFromDeeplink(
              `https://${branchDomain}/${token}`,
              branchKey
            );
            return deeplinkRef
              ? {
                  type: 'reference',
                  reference: deeplinkRef.reference,
                  path: deeplinkRef.path,
                }
              : null;
          },
        });
        if (lureLinkAttachment) {
          addAttachment(lureLinkAttachment);
        }
      },
      [branchDomain, branchKey, addAttachment, editor]
    );

    const onSelectMention = useCallback(
      async (contact: db.Contact) => {
        messageInputLogger.log('Selected mention', contact);
        const json = await editor.getJSON();
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

        // insert empty text node after mention
        newJson.content?.map((node) => {
          const containsMention = node.content?.some(
            (n) => n.type === 'mention'
          );
          if (containsMention) {
            node.content?.push({
              type: 'text',
              text: ' ',
            });
          }
        });

        messageInputLogger.log('onSelectMention, setting new content', newJson);
        // @ts-expect-error setContent does accept JSONContent
        editor.setContent(newJson);
        storeDraft(newJson, draftType);
        setMentionText('');
        setShowMentionPopup(false);
      },
      [editor, storeDraft, draftType]
    );

    const sendMessage = useCallback(
      async (isEdit?: boolean) => {
        const json = await editor.getJSON();
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

          if (
            image &&
            attachment.type === 'image' &&
            attachment.file.uri === image?.uri &&
            isEdit &&
            channelType === 'gallery'
          ) {
            return [
              {
                image: {
                  src: image.uri,
                  height: image.height,
                  width: image.width,
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
            await editPost?.(
              editingPost,
              story,
              editingPost.parentId,
              metadata
            );
          }
          await editPost?.(editingPost, story, undefined, metadata);
          setEditingPost?.(undefined);
        } else {
          // not awaiting since we don't want to wait for the send to complete
          // before clearing the draft and the editor content
          send(story, channelId, metadata);
        }

        onSend?.();
        editor.setContent('');
        clearAttachments();
        clearDraft(draftType);
        setShowBigInput?.(false);
      },
      [
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
        draftType,
      ]
    );

    const runSendMessage = useCallback(
      async (isEdit: boolean) => {
        setIsSending(true);
        try {
          await sendMessage(isEdit);
        } catch (e) {
          console.error('failed to send', e);
        }
        setIsSending(false);
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

    const handleAddNewLine = useCallback(() => {
      if (editorState.isCodeBlockActive) {
        editor.newLineInCode();
        return;
      }

      if (editorState.isBulletListActive || editorState.isOrderedListActive) {
        editor.splitListItem('listItem');
        return;
      }

      if (editorState.isTaskListActive) {
        editor.splitListItem('taskItem');
        return;
      }

      editor.splitBlock();
    }, [editor, editorState]);

    const handleMessage = useCallback(
      async (event: WebViewMessageEvent) => {
        const { data } = event.nativeEvent;
        if (data === 'enter') {
          handleAddNewLine();
          return;
        }

        if (data === 'shift-enter') {
          handleAddNewLine();
          return;
        }

        const { type, payload } = JSON.parse(data) as MessageEditorMessage;

        if (type === 'editor-ready') {
          webviewRef.current?.injectJavaScript(
            `
              function updateContentHeight() {
                const editorElement = document.querySelector('#root div .ProseMirror');
                editorElement.style.height = 'auto';
                editorElement.style.overflow = 'auto';
                const newHeight = editorElement.scrollHeight;
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'contentHeight', payload: newHeight }));
              }

              function setupMutationObserver() {
                // watch for changes in the content

                const observer = new MutationObserver(updateContentHeight);
                observer.observe(document.querySelector('#root'), { childList: true, subtree: true, attributes: true});

                updateContentHeight(); // this sets initial height
              }

              setupMutationObserver();
          `
          );

          return;
        }

        if (type === 'contentHeight') {
          if (payload === containerHeight) {
            return;
          }
          if (containerHeight > maxInputHeightBasic) {
            return;
          }
          setContainerHeight(payload);
          setHeight?.(payload);
          return;
        }

        if (type === 'paste') {
          handlePaste(payload);
          return;
        }

        editor.bridgeExtensions?.forEach((e) => {
          e.onEditorMessage && e.onEditorMessage({ type, payload }, editor);
          return;
        });

        if (type === 'content-error') {
          messageInputLogger.log('[webview] Content error', payload);
          if (!editorCrashed) {
            setEditorCrashed(payload);
          }
          return;
        }

        if (type === 'send-json-back') {
          return;
        }

        messageInputLogger.log('[webview] Unknown message from editor', {
          type,
          payload,
        });
      },
      [
        editor,
        handleAddNewLine,
        handlePaste,
        setHeight,
        webviewRef,
        editorCrashed,
        setEditorCrashed,
        containerHeight,
        maxInputHeightBasic,
      ]
    );

    const tentapInjectedJs = useMemo(
      () => getInjectedJS(editor.bridgeExtensions || []),
      [editor.bridgeExtensions]
    );

    useEffect(() => {
      if (bigInput) {
        Keyboard.addListener('keyboardDidShow', () => {
          // we should always have the keyboard height here but just in case
          const keyboardHeight = Keyboard.metrics()?.height || 300;
          setBigInputHeight(bigInputHeightBasic - keyboardHeight);
        });

        Keyboard.addListener('keyboardDidHide', () => {
          setBigInputHeight(bigInputHeightBasic);
        });
      }

      if (!bigInput) {
        Keyboard.addListener('keyboardDidShow', () => {
          const keyboardHeight = Keyboard.metrics()?.height || 300;
          setMaxInputHeight(maxInputHeightBasic - keyboardHeight);
        });

        Keyboard.addListener('keyboardDidHide', () => {
          setMaxInputHeight(maxInputHeightBasic);
        });
      }
    }, [bigInput, bigInputHeightBasic, maxInputHeightBasic]);

    // we need to check if the app within the webview actually loaded
    useEffect(() => {
      if (editorCrashed) {
        // if it hasn't loaded yet, we need to try loading the content again
        reloadWebview(`Editor crashed: ${editorCrashed}`);
      }
    }, [reloadWebview, editorCrashed]);

    const titleIsEmpty = useMemo(() => !title || title.length === 0, [title]);

    const handleCancelEditing = useCallback(() => {
      setEditingPost?.(undefined);
      editor.setContent('');
      clearDraft(draftType);
      clearAttachments();
    }, [setEditingPost, editor, clearDraft, clearAttachments, draftType]);

    return (
      <MessageInputContainer
        setShouldBlur={setShouldBlur}
        onPressSend={handleSend}
        onPressEdit={handleEdit}
        containerHeight={containerHeight}
        mentionText={mentionText}
        groupMembers={groupMembers}
        onSelectMention={onSelectMention}
        showMentionPopup={showMentionPopup}
        isEditing={!!editingPost}
        isSending={isSending}
        cancelEditing={handleCancelEditing}
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
          maxHeight={maxInputHeight}
        >
          {showInlineAttachments && <AttachmentPreviewList />}
          <XStack height={bigInput ? bigInputHeight : containerHeight}>
            <RichText
              style={{
                backgroundColor: 'transparent',
                maxHeight: maxInputHeight - getToken('$s', 'space'),
              }}
              editor={editor}
              onMessage={handleMessage}
              onError={(e) => {
                messageInputLogger.warn(
                  '[webview] Error from webview',
                  e.nativeEvent
                );
                reloadWebview('Error from webview');
              }}
              onRenderProcessGone={(e) => {
                // https://github.com/react-native-webview/react-native-webview/blob/master/docs/Reference.md#onrenderprocessgone
                messageInputLogger.warn(
                  '[webview] Render process gone',
                  e.nativeEvent.didCrash
                );
                reloadWebview(`Render process gone: ${e.nativeEvent.didCrash}`);
              }}
              onContentProcessDidTerminate={(e) => {
                // iOS will kill webview in background
                // https://github.com/react-native-webview/react-native-webview/blob/master/docs/Reference.md#oncontentprocessdidterminate
                messageInputLogger.warn(
                  '[webview] Content process terminated',
                  e
                );
                reloadWebview('Content process terminated');
              }}
              // we never want to see a loading indicator
              renderLoading={() => <></>}
              injectedJavaScript={`
              ${tentapInjectedJs}

              window.onerror = function(message, source, lineno, colno, error) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'content-error', payload: message }));
                return true;
              }

              window.addEventListener('error', function(e) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'content-error', payload: e.message }));
                return true;
              });

              window.addEventListener('unhandledrejection', function(e) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'content-error', payload: e.message }));
                return true;
              });

              window.addEventListener('keydown', (e) => {

                if (e.key === 'Enter' && !e.shiftKey) {
                  window.ReactNativeWebView.postMessage('enter');
                  return;
                }

                if (e.key === 'Enter' && e.shiftKey) {
                  window.ReactNativeWebView.postMessage('shift-enter');
                  return;
                }

              });

              window.addEventListener('message', (event) => {
                const message = event.data;
                if (message === 'ready') {
                  setupMutationObserver();
                }
              });
            `}
            />
          </XStack>
        </YStack>
      </MessageInputContainer>
    );
  }
);

MessageInput.displayName = 'MessageInput';
