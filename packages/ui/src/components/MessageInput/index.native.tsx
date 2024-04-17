import {
  BridgeExtension,
  EditorMessage,
  RichText,
  useBridgeState,
  useEditorBridge,
} from '@10play/tentap-editor';
import { editorHtml } from '@tloncorp/editor/dist/editorHtml';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Keyboard } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';

import { XStack } from '../../core';
import { MessageInputContainer, MessageInputProps } from './MessageInputBase';

// This function and the one below it are taken from RichText.tsx
// in the tentap-editor package.
// We need this because we're overriding the injectedJavaScript prop
// in the RichText component, and we need to make sure that the
// bridge extension CSS is injected into the WebView.
export const getStyleSheetCSS = (css: string, styleSheetTag: string) => {
  // We need to specify the placeholder CSS here because the placeholder bridge
  // extension is not picking up the placeholder content from the config.
  const placeholderCSS = `
    .is-editor-empty:first-child::before {
        color: #adb5bd;
        content: 'Message';
        float: left;
        height: 0;
        pointer-events: none;
    }
  `;

  return `
    cssContent = \`${styleSheetTag === 'placeholder' ? placeholderCSS : css}\`;
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
}: MessageInputProps) {
  const [containerHeight, setContainerHeight] = useState(0);
  const editor = useEditorBridge({
    customSource: editorHtml,
    autofocus: false,
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

  const handleEnter = useCallback(() => {
    Keyboard.dismiss();
    sendMessage();
  }, [sendMessage]);

  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      const { data } = event.nativeEvent;
      if (data === 'enter') {
        handleEnter();
        return;
      }

      const { type, payload } = JSON.parse(data) as EditorMessage;
      editor.bridgeExtensions?.forEach((e) => {
        e.onEditorMessage && e.onEditorMessage({ type, payload }, editor);
      });
    },
    [handleEnter]
  );

  const tentapInjectedJs = useMemo(
    () => getInjectedJS(editor.bridgeExtensions || []),
    [editor.bridgeExtensions]
  );

  return (
    <MessageInputContainer>
      <XStack
        borderRadius="$xl"
        minHeight="$4xl"
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

              });
            `}
        />
      </XStack>
    </MessageInputContainer>
  );
}
