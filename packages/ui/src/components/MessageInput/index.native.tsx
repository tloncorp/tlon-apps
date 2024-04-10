import {
  BridgeExtension,
  EditorMessage,
  RichText,
  useBridgeState,
  useEditorBridge,
} from '@10play/tentap-editor';
import { JSONContent } from '@tiptap/core';
import { editorHtml } from '@tloncorp/editor/dist/editorHtml';
import { tiptap } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import { constructStory } from '@tloncorp/shared/dist/urbit/channel';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Keyboard } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';

import { Attachment, Camera, ChannelGalleries, Send } from '../../assets/icons';
import { XStack } from '../../core';
import { IconButton } from '../IconButton';

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
  contacts,
  group,
  send,
  channelId,
}: {
  shouldBlur: boolean;
  setShouldBlur: (shouldBlur: boolean) => void;
  contacts: db.Contact[];
  group: db.GroupWithRelations;
  send: (content: JSONContent, channelId: string) => Promise<void>;
  channelId: string;
}) {
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

  const sendMessage = useCallback(() => {
    editor.getJSON().then(async (json) => {
      await send(json, channelId);

      editor.setContent('');

      console.log('sending message', json, channelId);
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
    <XStack
      paddingHorizontal="$m"
      paddingVertical="$s"
      gap="$l"
      alignItems="center"
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
      <XStack flex={1} gap="$l" alignItems="center">
        <XStack
          borderRadius="$xl"
          minHeight="$4xl"
          backgroundColor="$secondaryBackground"
          paddingHorizontal="$l"
          flex={1}
        >
          <RichText
            style={{
              padding: 8,
              backgroundColor: '$secondaryBackground',
              // height: '100%',
              flex: 1,
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
        <IconButton onPress={() => {}}>
          {/* TODO: figure out what send button should look like */}
          <Send />
        </IconButton>
      </XStack>
    </XStack>
  );
}
