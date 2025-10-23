import {
  BridgeExtension,
  EditorBridge,
  EditorMessage,
  PlaceholderBridge,
  RichText,
  TenTapStartKit,
  useBridgeState,
  useEditorBridge,
  useEditorContent,
} from '@10play/tentap-editor';
//ts-expect-error not typed
import { editorHtml } from '@tloncorp/editor/dist/editorHtml';
import {
  CodeBlockBridge,
  MentionsBridge,
  ShortcutsBridge,
} from '@tloncorp/editor/src/bridges';
import {
  Attachment,
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
import * as logic from '@tloncorp/shared/logic';
import * as ub from '@tloncorp/shared/urbit';
import {
  Inline,
  JSONContent,
  citeToPath,
  isInline,
  pathToCite,
} from '@tloncorp/shared/urbit';
import { HEADER_HEIGHT } from '@tloncorp/ui';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { WebViewMessageEvent } from 'react-native-webview';
import {
  XStack,
  YStack,
  getTokenValue,
  useTheme,
  useWindowDimensions,
} from 'tamagui';

import { useBranchDomain, useBranchKey } from '../../contexts';
import { useAttachmentContext } from '../../contexts/attachment';
import { AttachmentPreviewList } from './AttachmentPreviewList';
import { MessageInputContainer, MessageInputProps } from './MessageInputBase';
import { processReferenceAndUpdateEditor } from './helpers';

export const DEFAULT_MESSAGE_INPUT_HEIGHT = Platform.OS === 'web' ? 38 : 44;

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

export interface MessageInputHandle {
  editor: EditorBridge | null;
}

export const MessageInput = forwardRef<MessageInputHandle, MessageInputProps>(
  (
    {
      shouldBlur,
      setShouldBlur,
      sendPost,
      channelId,
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
      paddingHorizontal,
      initialHeight = DEFAULT_MESSAGE_INPUT_HEIGHT,
      placeholder = 'Message',
      bigInput = false,
      draftType,
      title,
      image,
      channelType,
      setHeight,
      shouldAutoFocus,
      goBack,
      onSend,
      onEditorStateChange,
      onEditorContentChange,
      onInitialContentSet,
      frameless = false,
    },
    ref
  ) => {
    const branchDomain = useBranchDomain();
    const branchKey = useBranchKey();
    const [sendError, setSendError] = useState(false);
    const [hasSetInitialContent, setHasSetInitialContent] = useState(false);
    useEffect(() => {
      hasSetInitialContent && onInitialContentSet?.();
      // Only want to trigger initially and on actual changes
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasSetInitialContent]);
    const [hasAutoFocused, setHasAutoFocused] = useState(false);
    const [editorCrashed, setEditorCrashed] = useState<string | undefined>();
    const [containerHeight, setContainerHeight] = useState(initialHeight);
    const [isSending, setIsSending] = useState(false);
    const { bottom, top } = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const titleInputHeight = 48;
    const imageInputButtonHeight = 50;
    const maxInputHeightBasic = useMemo(
      () => height - HEADER_HEIGHT - bottom - top,
      [height, bottom, top]
    );
    const bigInputHeightBasic = useMemo(() => {
      const extraHeaderSpace =
        channelType === 'notebook'
          ? titleInputHeight + imageInputButtonHeight + 150
          : 0;
      return height - top - HEADER_HEIGHT - extraHeaderSpace;
    }, [height, top, titleInputHeight, imageInputButtonHeight, channelType]);
    const [bigInputHeight, setBigInputHeight] = useState(bigInputHeightBasic);
    const [maxInputHeight, setMaxInputHeight] = useState(maxInputHeightBasic);

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
      autofocus: shouldAutoFocus || false,
      bridgeExtensions,
    });

    useImperativeHandle(ref, () => ({
      editor,
    }));

    const editorState = useBridgeState(editor);
    useEffect(() => {
      onEditorStateChange?.(editorState);
      // Only want to trigger initially and on actual changes
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editorState]);

    const editorContent = useEditorContent(editor, { type: 'json' });
    useEffect(() => {
      onEditorContentChange?.(editorContent);
      // Only want to trigger initially and on actual changes
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editorContent]);

    const webviewRef = editor.webviewRef;

    const reloadWebview = useCallback(
      (reason: string) => {
        webviewRef.current?.reload();
        messageInputLogger.log('[webview] Reloading webview, reason:', reason);
        setEditorCrashed(undefined);
      },
      [webviewRef]
    );

    const lastEditingPost = useRef<db.Post | undefined>(editingPost);

    useEffect(() => {
      if (!hasSetInitialContent && editorState.isReady) {
        messageInputLogger.log('Setting initial content');
        try {
          getDraft(draftType).then((draft) => {
            if (!editingPost && draft) {
              messageInputLogger.log(
                'Not editing and we have draft content',
                draft
              );
              // @ts-expect-error setContent does accept JSONContent
              editor.setContent(draft);
              setEditorIsEmpty(false);
              messageInputLogger.log(
                'set has set initial content, not editing'
              );
              setHasSetInitialContent(true);
            }

            if (editingPost && editingPost.content) {
              messageInputLogger.log('Editing post', editingPost.content);
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

              // Filter story to only include Verses (not ContentReferences) for diaryMixedToJSON
              const storyVerses = story
                ? story.filter((item): item is ub.Verse => !('type' in item))
                : [];
              const tiptapContent =
                storyVerses.length > 0
                  ? tiptap.diaryMixedToJSON(storyVerses)
                  : null;
              messageInputLogger.log(
                'Setting content with edit post content',
                tiptapContent
              );
              // @ts-expect-error setContent does accept JSONContent
              editor.setContent(tiptapContent);
              setEditorIsEmpty(false);
              messageInputLogger.log('set has set initial content, editing');
              setHasSetInitialContent(true);
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
      if (
        editor &&
        editorState.isReady &&
        !shouldBlur &&
        shouldAutoFocus &&
        !editorState.isFocused &&
        !hasAutoFocused
      ) {
        messageInputLogger.log('Auto focusing editor', editorState);
        editor.focus();
        messageInputLogger.log('Auto focused editor');
        setHasAutoFocused(true);
      }
    }, [shouldAutoFocus, editor, editorState, shouldBlur, hasAutoFocused]);

    useEffect(() => {
      if (editor && shouldBlur && editorState.isFocused) {
        editor.blur();
        messageInputLogger.log('Blurred editor');
        setShouldBlur(false);
      }
    }, [shouldBlur, editor, editorState, setShouldBlur]);

    useEffect(() => {
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

        if (isEmpty !== editorIsEmpty) {
          messageInputLogger.log('Editor is empty?', isEmpty);
          setEditorIsEmpty(isEmpty);
          setContainerHeight(initialHeight);
        }
      });
    }, [editor, attachments, editorIsEmpty, initialHeight]);

    editor._onContentUpdate = async () => {
      messageInputLogger.log(
        'Content updated, update draft and check for mention text'
      );

      const json = (await editor.getJSON()) as JSONContent;
      messageInputLogger.log('Storing draft', json);

      if (
        json.content?.length === 1 &&
        json.content[0].type === 'paragraph' &&
        !json.content[0].content
      ) {
        clearDraft(draftType);
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
          matchRegex: REF_REGEX,
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
            const deeplinkRef = await logic.getReferenceFromDeeplink({
              deepLink: deeplink,
              branchKey,
              branchDomain,
            });
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
            const deeplinkRef = await logic.getReferenceFromDeeplink({
              deepLink: `https://${branchDomain}/${token}`,
              branchKey,
              branchDomain,
            });
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

    const sendMessage = useCallback(
      async (isEdit?: boolean) => {
        const json = await editor.getJSON();
        const inlines = tiptap.JSONToInlines(json);
        const finalAttachments = await waitForAttachmentUploads();
        const { story, metadata } = logic.toPostData({
          content: inlines,
          attachments: finalAttachments,
          channelType: channelType,
          title,
          image: image?.uri,
          isEdit,
        });

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
          sendPost(story, channelId, metadata);
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
        sendPost,
        channelId,
        draftType,
      ]
    );

    const runSendMessage = useCallback(
      async (isEdit: boolean) => {
        try {
          setIsSending(true);
          await sendMessage(isEdit);
        } catch (e) {
          console.error('failed to send', e);
          setSendError(true);
        } finally {
          setIsSending(false);
          setSendError(false);
        }
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

    const handleMessage = useCallback(
      async (event: WebViewMessageEvent) => {
        const { data } = event.nativeEvent;
        messageInputLogger.log('[webview] Message from editor', data);

        const { type, payload } =
          typeof data === 'object'
            ? data
            : (JSON.parse(data) as MessageEditorMessage);

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
          if (
            payload &&
            typeof payload === 'string' &&
            // @ts-expect-error - this is a string
            payload.includes("(reading 'nodeSize')")
          ) {
            // We know this error is related to handlePaste within the editor in the webview,
            // it's incidental to the way we're using the editor, and it doesn't affect the
            // functionality of the editor. We can safely ignore it.
            return;
          }
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
      messageInputLogger.log('Setting up keyboard listeners');
      if (bigInput) {
        messageInputLogger.log('Setting up keyboard listeners for big input');
        const keyboardShowListener = Keyboard.addListener(
          'keyboardDidShow',
          (event) => {
            // Use the keyboard height from the event
            const keyboardHeight = event.endCoordinates.height;

            // Calculate extra space needed based on channel type
            const extraHeaderSpace =
              channelType === 'notebook'
                ? titleInputHeight +
                  imageInputButtonHeight +
                  getTokenValue('$l', 'space')
                : 0;

            // Calculate available height for editor - more precise with keyboard
            const availableHeight =
              height - keyboardHeight - top - HEADER_HEIGHT - extraHeaderSpace;

            setBigInputHeight(availableHeight);
          }
        );

        const keyboardHideListener = Keyboard.addListener(
          'keyboardDidHide',
          () => {
            setBigInputHeight(bigInputHeightBasic);
          }
        );

        return () => {
          keyboardShowListener.remove();
          keyboardHideListener.remove();
        };
      }

      if (!bigInput) {
        messageInputLogger.log('Setting up keyboard listeners for basic input');
        const keyboardShowListener = Keyboard.addListener(
          'keyboardDidShow',
          (event) => {
            const keyboardHeight = event.endCoordinates.height;
            setMaxInputHeight(maxInputHeightBasic - keyboardHeight);
          }
        );

        const keyboardHideListener = Keyboard.addListener(
          'keyboardDidHide',
          () => {
            setMaxInputHeight(maxInputHeightBasic);
          }
        );

        return () => {
          keyboardShowListener.remove();
          keyboardHideListener.remove();
        };
      }
    }, [
      bigInput,
      bigInputHeightBasic,
      maxInputHeightBasic,
      height,
      top,
      bottom,
      channelType,
    ]);

    // we need to check if the app within the webview actually loaded
    useEffect(() => {
      if (editorCrashed) {
        messageInputLogger.warn('Editor crashed', editorCrashed);
        // if it hasn't loaded yet, we need to try loading the content again
        reloadWebview(`Editor crashed: ${editorCrashed}`);
      }
    }, [reloadWebview, editorCrashed]);

    const titleIsEmpty = useMemo(() => !title || title.length === 0, [title]);

    const handleCancelEditing = useCallback(() => {
      setEditingPost?.(undefined);
      setHasSetInitialContent(false);
      editor.setContent('');
      clearDraft(draftType);
      clearAttachments();
    }, [setEditingPost, editor, clearDraft, clearAttachments, draftType]);

    const primaryTextColor = useTheme().primaryText.val;
    const backgroundColorValue = useTheme().background.val;
    const injectThemeColors = `
      document.body.style.backgroundColor = '${backgroundColorValue}';
      document.body.style.color = '${primaryTextColor}';
    `;

    return (
      <MessageInputContainer
        setShouldBlur={setShouldBlur}
        onPressSend={handleSend}
        onPressEdit={handleEdit}
        containerHeight={containerHeight}
        sendError={sendError}
        mentionOptions={[]}
        onSelectMention={() => {}}
        isEditing={!!editingPost}
        cancelEditing={handleCancelEditing}
        showAttachmentButton={showAttachmentButton}
        floatingActionButton={floatingActionButton}
        disableSend={
          editorIsEmpty ||
          (channelType === 'notebook' && titleIsEmpty) ||
          isSending
        }
        goBack={goBack}
        frameless={frameless}
      >
        <YStack
          flex={1}
          paddingHorizontal={paddingHorizontal}
          borderColor={frameless ? 'transparent' : '$border'}
          borderWidth={frameless ? 0 : 1}
          borderRadius={frameless ? 0 : '$xl'}
          maxHeight={bigInput ? undefined : maxInputHeight}
          paddingTop={bigInput && frameless ? '$s' : undefined}
        >
          {showInlineAttachments && <AttachmentPreviewList />}
          <XStack
            height={bigInput ? bigInputHeight : containerHeight}
            style={{ width: '100%' }}
          >
            <RichText
              style={{
                maxHeight: bigInput ? bigInputHeight : maxInputHeight,
                width: '100%',
                flex: 1,
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
              ${injectThemeColors}

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
