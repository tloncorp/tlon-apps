import {
  BridgeExtension,
  EditorMessage,
  PlaceholderBridge,
  RichText,
  TenTapStartKit,
  useBridgeState,
  useEditorBridge,
} from '@10play/tentap-editor';
//ts-expect-error not typed
import { editorHtml } from '@tloncorp/editor/dist/editorHtml';
import { MentionsBridge, ShortcutsBridge } from '@tloncorp/editor/src/bridges';
import { tiptap } from '@tloncorp/shared/dist';
import { toContentReference } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import {
  Block,
  Inline,
  JSONContent,
  constructStory,
  isInline,
  pathToCite,
} from '@tloncorp/shared/dist/urbit';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Keyboard } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';

import { useReferences } from '../../contexts/references';
import { XStack } from '../../core';
import { MessageInputContainer, MessageInputProps } from './MessageInputBase';

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

// 52 accounts for the 16px padding around the text within the input
// and the 20px line height of the text. 16 + 20 + 16 = 52
const DEFAULT_CONTAINER_HEIGHT = 52;

export function MessageInput({
  shouldBlur,
  setShouldBlur,
  send,
  channelId,
  setImageAttachment,
  uploadedImage,
  canUpload,
  groupMembers,
  storeDraft,
  clearDraft,
  getDraft,
}: MessageInputProps) {
  const [hasSetInitialContent, setHasSetInitialContent] = useState(false);
  const [containerHeight, setContainerHeight] = useState(
    DEFAULT_CONTAINER_HEIGHT
  );
  const [mentionText, setMentionText] = useState<string>();
  const [editorIsEmpty, setEditorIsEmpty] = useState(true);
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const { references, setReferences } = useReferences();
  const editor = useEditorBridge({
    customSource: editorHtml,
    autofocus: false,
    bridgeExtensions: [
      ...TenTapStartKit,
      PlaceholderBridge.configureExtension({
        placeholder: 'Message',
      }),
      MentionsBridge,
      ShortcutsBridge,
    ],
  });
  const editorState = useBridgeState(editor);
  const webviewRef = editor.webviewRef;

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
        });
      } catch (e) {
        console.error('Error getting draft', e);
      }
    }
  }, [editor, getDraft, hasSetInitialContent, editorState.isReady]);

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
          (c) => typeof c === 'string' || (typeof c === 'object' && isInline(c))
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
        !uploadedImage &&
        Object.entries(references).filter(([, ref]) => ref !== null).length ===
          0;

      if (isEmpty !== editorIsEmpty) {
        setEditorIsEmpty(isEmpty);
      }
    });
  }, [editor, references, uploadedImage, editorIsEmpty]);

  editor._onContentUpdate = async () => {
    editor.getJSON().then((json: JSONContent) => {
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
    });
  };

  const handlePaste = useCallback(
    (pastedText: string) => {
      if (pastedText) {
        const isRef = pastedText.match(tiptap.REF_REGEX);

        if (isRef) {
          const cite = pathToCite(isRef[0]);

          if (cite) {
            const reference = toContentReference(cite);
            setReferences({ [isRef[0]]: reference });

            editor.getJSON().then((json: JSONContent) => {
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
              // editor.setSelection(initialSelection.from, initialSelection.to);
            });
          }
        }
      }
    },
    [editor, setReferences]
  );

  const onSelectMention = useCallback(
    (contact: db.Contact) => {
      editor.getJSON().then(async (json) => {
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
      });
      setMentionText('');
      setShowMentionPopup(false);
    },
    [editor, storeDraft]
  );

  const sendMessage = useCallback(() => {
    editor.getJSON().then(async (json) => {
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

      if (uploadedImage) {
        blocks.push({
          image: {
            src: uploadedImage.url,
            height: uploadedImage.size ? uploadedImage.size[0] : 200,
            width: uploadedImage.size ? uploadedImage.size[1] : 200,
            alt: 'image',
          },
        });
      }

      if (blocks && blocks.length > 0) {
        story.push(...blocks.map((block) => ({ block })));
      }

      await send(story, channelId);

      editor.setContent('');
      setReferences({});
      clearDraft();
    });
  }, [
    editor,
    send,
    channelId,
    uploadedImage,
    references,
    setReferences,
    clearDraft,
  ]);

  const handleSend = useCallback(() => {
    Keyboard.dismiss();
    sendMessage();
  }, [sendMessage]);

  const handleAddNewLine = useCallback(() => {
    editor.splitBlock();
  }, [editor]);

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
      }

      if (type === 'contentHeight') {
        setContainerHeight(payload);
        return;
      }

      if (type === 'paste') {
        handlePaste(payload);
        return;
      }

      editor.bridgeExtensions?.forEach((e) => {
        e.onEditorMessage && e.onEditorMessage({ type, payload }, editor);
      });
    },
    [editor, handleAddNewLine, handlePaste]
  );

  const tentapInjectedJs = useMemo(
    () => getInjectedJS(editor.bridgeExtensions || []),
    [editor.bridgeExtensions]
  );

  return (
    <MessageInputContainer
      setImageAttachment={setImageAttachment}
      onPressSend={handleSend}
      uploadedImage={uploadedImage}
      canUpload={canUpload}
      containerHeight={containerHeight}
      mentionText={mentionText}
      groupMembers={groupMembers}
      onSelectMention={onSelectMention}
      showMentionPopup={showMentionPopup}
      editorIsEmpty={editorIsEmpty}
    >
      <XStack
        borderRadius="$xl"
        height={containerHeight}
        backgroundColor="$secondaryBackground"
        paddingHorizontal="$l"
        flex={1}
      >
        <RichText
          style={{
            padding: 8,
            backgroundColor: '$secondaryBackground',
          }}
          editor={editor}
          onMessage={handleMessage}
          injectedJavaScript={`
              ${tentapInjectedJs}

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
