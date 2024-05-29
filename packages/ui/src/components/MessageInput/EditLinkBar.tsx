import { EditorTheme, Images } from '@10play/tentap-editor';
import React from 'react';
import { TextInput, TouchableOpacity } from 'react-native';

import { Image, Text, View } from '../../core';

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
      <TextInput
        value={link}
        onBlur={onBlur}
        onChangeText={setLink}
        placeholder="Type your URL here..."
        placeholderTextColor={theme.toolbar.linkBarTheme.placeholderTextColor}
        autoFocus
        style={theme.toolbar.linkBarTheme.linkInput}
        autoCapitalize="none"
      />
      <TouchableOpacity
        style={theme.toolbar.linkBarTheme.doneButton}
        onPress={() => {
          onEditLink(link);
        }}
      >
        <Text style={theme.toolbar.linkBarTheme.doneButtonText}>Insert</Text>
      </TouchableOpacity>
    </View>
  );
};
