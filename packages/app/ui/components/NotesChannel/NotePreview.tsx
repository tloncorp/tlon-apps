import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type * as cn from '@tloncorp/shared/logic';
import { useCallback } from 'react';

import type { RootStackParamList } from '../../../navigation/types';
import { NotebookContentRenderer } from '../NotebookPost/NotebookPost';

// Web keeps the browser's own selection over the React renderer.
export function NotePreview({
  content,
  testID,
}: {
  content: cn.PostContent;
  testID?: string;
}) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const handlePressImage = useCallback(
    (src: string) => {
      navigation.navigate('MediaViewer', { mediaType: 'image', uri: src });
    },
    [navigation]
  );
  return (
    <NotebookContentRenderer
      content={content}
      marginHorizontal="$-l"
      onPressImage={handlePressImage}
      testID={testID}
    />
  );
}
