import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AnalyticsEvent, trackEvent } from '@tloncorp/shared';
import type * as cn from '@tloncorp/shared/logic';
import { requireNativeViewManager } from 'expo-modules-core';
import { type ComponentType, useCallback, useMemo, useState } from 'react';
import { Linking, type ViewProps, processColor } from 'react-native';
import { useTheme } from 'tamagui';

import type { RootStackParamList } from '../../../navigation/types';
import { useCalm, useContactIndex } from '../../contexts/appDataContext';
import { resolveContactNameProps } from '../contactNameResolver';
import { buildNoteDocument } from './noteDocument';

type NativeEvent<T> = { nativeEvent: T };

type NativeNotePreviewProps = ViewProps & {
  // JSON of NoteDocumentBlock[] (see noteDocument.ts).
  documentJson: string;
  // JSON of colours as processColor values, keyed as in themeColors below.
  themeJson: string;
  onContentHeight: (event: NativeEvent<{ height: number }>) => void;
  onPressLink: (event: NativeEvent<{ url: string }>) => void;
  onPressMention: (event: NativeEvent<{ contactId: string }>) => void;
  onPressImage: (event: NativeEvent<{ src: string }>) => void;
  onPressVideo: (
    event: NativeEvent<{ src: string; posterUri?: string }>
  ) => void;
};

const NativeNotePreview: ComponentType<NativeNotePreviewProps> =
  requireNativeViewManager<NativeNotePreviewProps>('TlonNotePreview');

const themeColors = {
  text: 'primaryText',
  tertiaryText: 'tertiaryText',
  mention: 'positiveActionText',
  mentionBackground: 'positiveBackground',
  codeBackground: 'secondaryBackground',
  border: 'border',
} as const;

// On iOS and Android the preview is one native text document, so a selection
// can run across the whole note: through headings, lists, quotes, code,
// images and tables.
export function NotePreview({
  content,
  testID,
}: {
  content: cn.PostContent;
  testID?: string;
}) {
  const theme = useTheme();
  const contactIndex = useContactIndex();
  const calm = useCalm();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [height, setHeight] = useState(0);

  const documentJson = useMemo(
    () =>
      JSON.stringify(
        buildNoteDocument(
          content,
          (contactId) =>
            resolveContactNameProps({
              contact: contactIndex?.[contactId] ?? null,
              contactId,
              calmDisableNicknames: calm.disableNicknames,
            }).children
        )
      ),
    [calm.disableNicknames, contactIndex, content]
  );

  const themeJson = useMemo(
    () =>
      JSON.stringify(
        Object.fromEntries(
          Object.entries(themeColors).map(([key, token]) => [
            key,
            processColor(
              (theme as Record<string, { val?: string } | undefined>)[token]
                ?.val
            ),
          ])
        )
      ),
    [theme]
  );

  const handlePressLink = useCallback((event: NativeEvent<{ url: string }>) => {
    trackEvent(AnalyticsEvent.ExternalLinkOpened);
    void Linking.openURL(event.nativeEvent.url);
  }, []);
  const handlePressMention = useCallback(
    (event: NativeEvent<{ contactId: string }>) => {
      navigation.navigate('UserProfile', {
        userId: event.nativeEvent.contactId,
      });
    },
    [navigation]
  );
  const handlePressImage = useCallback(
    (event: NativeEvent<{ src: string }>) => {
      navigation.navigate('MediaViewer', {
        mediaType: 'image',
        uri: event.nativeEvent.src,
      });
    },
    [navigation]
  );
  const handlePressVideo = useCallback(
    (event: NativeEvent<{ src: string; posterUri?: string }>) => {
      navigation.navigate('MediaViewer', {
        mediaType: 'video',
        uri: event.nativeEvent.src,
        posterUri: event.nativeEvent.posterUri,
      });
    },
    [navigation]
  );

  return (
    <NativeNotePreview
      testID={testID}
      style={{ width: '100%', height }}
      documentJson={documentJson}
      themeJson={themeJson}
      onContentHeight={(event) => setHeight(event.nativeEvent.height)}
      onPressLink={handlePressLink}
      onPressMention={handlePressMention}
      onPressImage={handlePressImage}
      onPressVideo={handlePressVideo}
    />
  );
}
