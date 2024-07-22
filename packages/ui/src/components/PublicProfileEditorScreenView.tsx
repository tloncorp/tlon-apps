import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { View } from '../core';
import { GenericHeader } from './GenericHeader';
import { WidgetGrid } from './ProfileEditor/WidgetGrid';
import { EditorContextProvider } from './ProfileEditor/editorContext';

interface Props {
  goBack: () => void;
}

export function PublicProfileEditorScreenView({ goBack }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <EditorContextProvider>
      <GenericHeader title="Edit Profile" goBack={goBack} />
      <View flex={1}>
        <WidgetGrid />
      </View>
    </EditorContextProvider>
  );
}
