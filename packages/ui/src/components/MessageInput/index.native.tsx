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
import { ShortcutsBridge } from '@tloncorp/editor/src/bridges';
import { tiptap } from '@tloncorp/shared/dist';
import {
  ContentReference,
  toContentReference,
} from '@tloncorp/shared/dist/api';
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
}: MessageInputProps) {
  const [containerHeight, setContainerHeight] = useState(
    DEFAULT_CONTAINER_HEIGHT
  );
  const { references, setReferences } = useReferences();
  const editor = useEditorBridge({
    customSource: editorHtml,
    autofocus: false,
    bridgeExtensions: [
      ...TenTapStartKit,
      PlaceholderBridge.configureExtension({
        placeholder: 'Message',
      }),
      ShortcutsBridge,
    ],
  });
  const editorState = useBridgeState(editor);
  const webviewRef = editor.webviewRef;

  useEffect(() => {
    if (editor && shouldBlur && editorState.isFocused) {
      editor.blur();
      setShouldBlur(false);
    }
  }, [shouldBlur, editor, editorState, setShouldBlur]);

  editor._onContentUpdate = () => {
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
      const inlinesWithRefs = inlines.filter((inline) => {
        if (typeof inline === 'string') {
          return inline.match(tiptap.REF_REGEX);
        }
        return false;
      });
      const inlinesWithOutRefs = inlines
        .map((inline) => {
          if (typeof inline === 'string') {
            const inlineLength = inline.length;
            const refLength = inline.match(tiptap.REF_REGEX)?.[0].length || 0;

            if (inlineLength === refLength) {
              return null;
            }

            return inline.replace(tiptap.REF_REGEX, '');
          }
          return inline;
        })
        .filter((inline) => inline !== null) as string[];

      const refs: Record<string, string> = {};

      inlinesWithRefs.forEach((inline: string) => {
        const matches = inline.match(tiptap.REF_REGEX);
        if (matches) {
          refs[matches[0]] = matches[0];
        }
      });

      // const cites: Record<string, Cite> = {};
      const newRefs: Record<string, ContentReference | null> = {};

      Object.keys(refs).forEach((ref) => {
        const cite = pathToCite(ref);
        // we're limimting the number of refs that can be added to 1
        // for now. TODO: figure out how we want to render multiple refs
        if (cite) {
          const reference = toContentReference(cite);
          newRefs[ref] = reference;
        }
      });

      if (Object.keys(newRefs).length) {
        setReferences(newRefs);
      }

      const newStory = constructStory(inlinesWithOutRefs);

      if (blocks && blocks.length > 0) {
        newStory.push(...blocks.map((block) => ({ block })));
      }

      const newJson = tiptap.diaryMixedToJSON(newStory);

      // @ts-expect-error setContent does accept JSONContent
      editor.setContent(newJson);
    });
  };

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
    });
  }, [editor, send, channelId, uploadedImage]);

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

      editor.bridgeExtensions?.forEach((e) => {
        e.onEditorMessage && e.onEditorMessage({ type, payload }, editor);
      });
    },
    [editor, handleAddNewLine]
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
