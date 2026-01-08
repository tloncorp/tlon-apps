import type { EditorTheme } from '@10play/tentap-editor';
import { Button } from '@tloncorp/ui';
import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Input, View, useTheme } from 'tamagui';

interface EditLinkBarProps {
  theme: EditorTheme;
  onBlur: () => void;
  onEditLink: (newLink: string) => void;
  onLinkIconClick: () => void;
  initialLink: string | undefined;
  backgroundColor?: string;
}

export const EditLinkBar = ({
  theme,
  initialLink,
  onEditLink,
  onLinkIconClick,
  onBlur,
  backgroundColor,
}: EditLinkBarProps) => {
  const [link, setLink] = React.useState(initialLink || '');
  const tamagui = useTheme();

  const bgColor = backgroundColor || tamagui.background.val;

  const containerStyle = [
    theme.toolbar.linkBarTheme.addLinkContainer,
    { backgroundColor: bgColor, borderWidth: 0 },
  ];

  return (
    <View style={containerStyle}>
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
          {/*
          <Image
            source={Images.link}
            style={[theme.toolbar.icon]}
            resizeMode="contain"
          />
          */}
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
        backgroundColor={bgColor}
      />
      <Button
        fill="outline"
        type="primary"
        onPress={() => {
          onEditLink(link);
        }}
        label="Insert"
      />
    </View>
  );
};
