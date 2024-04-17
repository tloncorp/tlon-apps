import {
  BridgeExtension,
  EditorMessage,
  PlaceholderBridge,
  RichText,
  TenTapStartKit,
  useBridgeState,
  useEditorBridge,
} from '@10play/tentap-editor';
import { JSONContent } from '@tiptap/core';
import { editorHtml } from '@tloncorp/editor/dist/editorHtml';
import { ShortcutsBridge } from '@tloncorp/editor/src/bridges/shortcut';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Keyboard } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';

import { Attachment, Camera, ChannelGalleries, Send } from '../../assets/icons';
import { XStack } from '../../core';
import { IconButton } from '../IconButton';

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

export function MessageInput({
  shouldBlur,
  setShouldBlur,
  send,
  channelId,
}: {
  shouldBlur: boolean;
  setShouldBlur: (shouldBlur: boolean) => void;
  send: (content: JSONContent, chatId: string) => Promise<void>;
  channelId: string;
}) {
  const [conatinerHeight, setContainerHeight] = useState(0);
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

  useEffect(() => {
    if (editor && shouldBlur && editorState.isFocused) {
      editor.blur();
      setShouldBlur(false);
    }
  }, [shouldBlur, editor, editorState]);

  editor._onContentUpdate = () => {
    editor.getText().then((text) => {
      if (text.length < 25) {
        setContainerHeight(48);
        return;
      }

      // set the height of the container based on the text length.
      // every 36 characters, add 16px to the height
      // TODO: do this a better way
      // TODO: account for line breaks
      const height = Math.max(64, 64 + Math.floor(text.length / 25) * 16);
      setContainerHeight(height);
    });
  };

  const sendMessage = useCallback(() => {
    editor.getJSON().then(async (json) => {
      await send(json, channelId);

      editor.setContent('');
    });
  }, [editor, send, channelId]);

  const handleSend = useCallback(() => {
    Keyboard.dismiss();
    sendMessage();
  }, [sendMessage]);

  const handleAddNewLine = useCallback(() => {
    editor.splitBlock();
  }, []);

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

      const { type, payload } = JSON.parse(data) as EditorMessage;
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
    <XStack
      paddingHorizontal="$m"
      paddingVertical="$s"
      gap="$l"
      alignItems="flex-end"
    >
      <XStack gap="$l">
        <IconButton onPress={() => {}}>
          <Camera />
        </IconButton>
        <IconButton onPress={() => {}}>
          <Attachment />
        </IconButton>
        <IconButton onPress={() => {}}>
          <ChannelGalleries />
        </IconButton>
      </XStack>
      <XStack flex={1} gap="$l" alignItems="flex-end">
        <XStack
          borderRadius="$xl"
          minHeight="$4xl"
          height={conatinerHeight}
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
            `}
          />
        </XStack>
        <IconButton onPress={handleSend}>
          {/* TODO: figure out what send button should look like */}
          <Send />
        </IconButton>
      </XStack>
    </XStack>
  );
}
