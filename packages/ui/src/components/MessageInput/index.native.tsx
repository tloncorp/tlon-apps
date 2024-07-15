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
import { createDevLogger, tiptap } from '@tloncorp/shared/dist';
import { PostContent, toContentReference } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import {
  Block,
  Inline,
  JSONContent,
  Story,
  constructStory,
  isInline,
  pathToCite,
} from '@tloncorp/shared/dist/urbit';
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
import { getToken, useWindowDimensions } from 'tamagui';

import { useReferences } from '../../contexts/references';
import { XStack } from '../../core';
import { MessageInputContainer, MessageInputProps } from './MessageInputBase';

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
      uploadInfo,
      groupMembers,
      storeDraft,
      clearDraft,
      getDraft,
      editingPost,
      setEditingPost,
      editPost,
      setShowBigInput,
      showAttachmentButton = true,
      floatingActionButton = false,
      backgroundColor = '$background',
      paddingHorizontal,
      initialHeight = DEFAULT_MESSAGE_INPUT_HEIGHT,
      placeholder = 'Message',
      bigInput = false,
      title,
      image,
      channelType,
      setHeight,
      goBack,
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

    const [hasSetInitialContent, setHasSetInitialContent] = useState(false);
    const [editorCrashed, setEditorCrashed] = useState<string | undefined>();
    const [containerHeight, setContainerHeight] = useState(initialHeight);
    const { bottom, top } = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const headerHeight = 48;
    const titleInputHeight = 48;
    const inputBasePadding = getToken('$s', 'space');
    const imageInputButtonHeight = 50;
    const basicOffset =
      top + headerHeight + titleInputHeight + imageInputButtonHeight;
    const bigInputHeightBasic =
      height - basicOffset - bottom - inputBasePadding * 2;
    const [bigInputHeight, setBigInputHeight] = useState(bigInputHeightBasic);
    const [mentionText, setMentionText] = useState<string>();
    const [editorIsEmpty, setEditorIsEmpty] = useState(true);
    const [showMentionPopup, setShowMentionPopup] = useState(false);
    const { references, setReferences } = useReferences();
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

    useEffect(() => {
      if (!hasSetInitialContent && editorState.isReady) {
        try {
          getDraft().then((draft) => {
            if (draft) {
              // @ts-expect-error setContent does accept JSONContent
              editor.setContent(draft);
              setHasSetInitialContent(true);
              setEditorIsEmpty(false);
            }
            if (editingPost?.content) {
              const content = JSON.parse(
                editingPost.content as string
              ) as PostContent;

              if (!content) {
                return;
              }

              const story =
                (content.filter(
                  (c) => 'inline' in c || 'block' in c
                ) as Story) ?? [];
              const tiptapContent = tiptap.diaryMixedToJSON(story);
              // @ts-expect-error setContent does accept JSONContent
              editor.setContent(tiptapContent);
              setHasSetInitialContent(true);
            }
          });
        } catch (e) {
          messageInputLogger.error('Error getting draft', e);
        }
      }
    }, [
      editor,
      getDraft,
      hasSetInitialContent,
      editorState.isReady,
      editingPost,
    ]);

    useEffect(() => {
      if (editor && shouldBlur && editorState.isFocused) {
        editor.blur();
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
          (tiptap
            .JSONToInlines(json)
            .filter((c) => typeof c !== 'string' && 'block' in c) as Block[]) ||
          [];

        const inlineIsJustBreak = !!(
          inlines.length === 1 &&
          inlines[0] &&
          typeof inlines[0] === 'object' &&
          'break' in inlines[0]
        );

        const isEmpty =
          (inlines.length === 0 || inlineIsJustBreak) &&
          blocks.length === 0 &&
          !uploadInfo?.uploadedImage &&
          Object.entries(references).filter(([, ref]) => ref !== null)
            .length === 0;

        if (isEmpty !== editorIsEmpty) {
          setEditorIsEmpty(isEmpty);
        }
      });
    }, [editor, references, uploadInfo, editorIsEmpty]);

    editor._onContentUpdate = async () => {
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
    };

    const handlePaste = useCallback(
      async (pastedText: string) => {
        if (pastedText) {
          const isRef = pastedText.match(tiptap.REF_REGEX);

          if (isRef) {
            const cite = pathToCite(isRef[0]);

            if (cite) {
              const reference = toContentReference(cite);
              setReferences({ [isRef[0]]: reference });
              const json = await editor.getJSON();
              const inlines = tiptap
                .JSONToInlines(json)
                .filter(
                  (c) =>
                    typeof c === 'string' ||
                    (typeof c === 'object' && isInline(c))
                ) as Inline[];
              const blocks =
                (tiptap
                  .JSONToInlines(json)
                  .filter(
                    (c) => typeof c !== 'string' && 'block' in c
                  ) as Block[]) || [];

              // then we need to find all the inlines without refs
              // so we can render the input text without refs
              const inlinesWithOutRefs = inlines
                .map((inline) => {
                  if (typeof inline === 'string') {
                    const inlineLength = inline.length;
                    const refLength =
                      inline.match(tiptap.REF_REGEX)?.[0].length || 0;

                    if (inlineLength === refLength) {
                      return null;
                    }

                    return inline.replace(tiptap.REF_REGEX, '');
                  }
                  return inline;
                })
                .filter((inline) => inline !== null) as string[];

              // we construct a story here so we can insert blocks back in
              // and then convert it back to tiptap's JSON format
              const newStory = constructStory(inlinesWithOutRefs);

              if (blocks && blocks.length > 0) {
                newStory.push(...blocks.map((block) => ({ block })));
              }

              const newJson = tiptap.diaryMixedToJSON(newStory);

              // @ts-expect-error setContent does accept JSONContent
              editor.setContent(newJson);
            }
          }
        }
      },
      [editor, setReferences]
    );

    const onSelectMention = useCallback(
      async (contact: db.Contact) => {
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

        // @ts-expect-error setContent does accept JSONContent
        editor.setContent(newJson);
        storeDraft(newJson);
        setMentionText('');
        setShowMentionPopup(false);
      },
      [editor, storeDraft]
    );

    const sendMessage = useCallback(
      async (isEdit?: boolean) => {
        const json = await editor.getJSON();
        const blocks: Block[] = [];
        const inlines = tiptap.JSONToInlines(json);
        const story = constructStory(inlines);

        if (Object.keys(references).length) {
          Object.keys(references).forEach((ref) => {
            const cite = pathToCite(ref);
            if (!cite) {
              return;
            }
            blocks.push({ cite });
          });
        }

        if (!image && uploadInfo?.uploadedImage) {
          blocks.push({
            image: {
              src: uploadInfo.uploadedImage.url,
              height: uploadInfo.uploadedImage.height,
              width: uploadInfo.uploadedImage.width,
              alt: 'image',
            },
          });
        }

        if (blocks && blocks.length > 0) {
          story.push(...blocks.map((block) => ({ block })));
        }

        if (isEdit && editingPost) {
          if (editingPost.parentId) {
            await editPost?.(editingPost, story, editingPost.parentId);
          }
          await editPost?.(editingPost, story);
          setEditingPost?.(undefined);
        } else {
          const metadata: db.PostMetadata = {};
          if (title && title.length > 0) {
            metadata['title'] = title;
          }

          if (image && image.url && image.url.length > 0) {
            metadata['image'] = image.url;
          }

          // not awaiting since we don't want to wait for the send to complete
          // before clearing the draft and the editor content
          send(story, channelId, metadata);
        }

        editor.setContent('');
        setReferences({});
        clearDraft();
        setShowBigInput?.(false);
      },
      [
        editor,
        send,
        channelId,
        uploadInfo,
        references,
        setReferences,
        clearDraft,
        editPost,
        editingPost,
        setEditingPost,
        setShowBigInput,
        title,
        image,
      ]
    );

    const handleSend = useCallback(async () => {
      Keyboard.dismiss();
      await sendMessage();
    }, [sendMessage]);

    const handleEdit = useCallback(async () => {
      Keyboard.dismiss();
      if (!editingPost) {
        return;
      }

      await sendMessage(true);
    }, [sendMessage, editingPost]);

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
    }, [bigInput, bigInputHeightBasic]);

    // we need to check if the app within the webview actually loaded
    useEffect(() => {
      if (editorCrashed) {
        // if it hasn't loaded yet, we need to try loading the content again
        reloadWebview(`Editor crashed: ${editorCrashed}`);
      }
    }, [reloadWebview, editorCrashed]);

    const titleIsEmpty = useMemo(() => !title || title.length === 0, [title]);

    return (
      <MessageInputContainer
        setShouldBlur={setShouldBlur}
        onPressSend={handleSend}
        onPressEdit={handleEdit}
        uploadInfo={uploadInfo}
        containerHeight={containerHeight}
        mentionText={mentionText}
        groupMembers={groupMembers}
        onSelectMention={onSelectMention}
        showMentionPopup={showMentionPopup}
        isEditing={!!editingPost}
        cancelEditing={() => setEditingPost?.(undefined)}
        showAttachmentButton={showAttachmentButton}
        floatingActionButton={floatingActionButton}
        disableSend={
          editorIsEmpty || (channelType === 'notebook' && titleIsEmpty)
        }
        goBack={goBack}
      >
        <XStack
          borderRadius="$xl"
          height={bigInput ? bigInputHeight : containerHeight}
          backgroundColor={backgroundColor}
          paddingHorizontal={paddingHorizontal}
          flex={1}
          borderColor="$shadow"
          borderWidth={1}
        >
          <RichText
            style={{
              backgroundColor: 'transparent',
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
      </MessageInputContainer>
    );
  }
);

MessageInput.displayName = 'MessageInput';
