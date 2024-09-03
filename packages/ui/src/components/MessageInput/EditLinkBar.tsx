import { EditorTheme, Images } from '@10play/tentap-editor';
import React from 'react';
import { TouchableOpacity } from 'react-native';
// TODO: replace with our own input component
import { Input, View } from 'tamagui';

import { Button } from '../Button';
import { Image } from '../Image';

interface EditLinkBarProps {
  theme: EditorTheme;
  onBlur: () => void;
  onEditLink: (newLink: string) => void;
  onLinkIconClick: () => void;
  initialLink: string | undefined;
}

export const EditLinkBar = ({
  theme,
  initialLink,
  onEditLink,
  onLinkIconClick,
  onBlur,
}: EditLinkBarProps) => {
  const [link, setLink] = React.useState(initialLink || '');

  return (
    <View style={theme.toolbar.linkBarTheme.addLinkContainer}>
      {/* TODO: replace with our own button component and styles */}
      <TouchableOpacity
        onPress={onLinkIconClick}
        style={[
          theme.toolbar.toolbarButton,
          theme.toolbar.linkBarTheme.linkToolbarButton,
        ]}
      >
        <View
          style={[theme.toolbar.iconWrapper, theme.toolbar.iconWrapperActive]}
        >
          <Image
            source={Images.link}
            style={[theme.toolbar.icon]}
            resizeMode="contain"
          />
        </View>
      </TouchableOpacity>
      <Input
        value={link}
        flex={1}
        borderWidth={0}
        onBlur={onBlur}
        onChangeText={setLink}
        placeholder="Type your URL here..."
        autoFocus
        autoCapitalize="none"
      />
      <Button
        onPress={() => {
          onEditLink(link);
        }}
      >
        <Button.Text>Insert</Button.Text>
      </Button>
    </View>
  );
};
