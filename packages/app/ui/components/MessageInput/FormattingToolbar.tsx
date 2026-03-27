import { Icon, Text } from '@tloncorp/ui';
import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  ListRenderItem,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Input, View, XStack, useTheme } from 'tamagui';

import { useIsDarkTheme } from '../../utils';
import {
  HEADING_ITEMS,
  TlonBridgeState,
  TlonEditorBridge,
  ToolbarContext,
  type ToolbarItem,
} from './toolbarActions';

interface FormattingToolbarProps {
  editor: TlonEditorBridge;
  editorState: TlonBridgeState;
  hidden?: boolean;
  items: ToolbarItem[];
  style?: StyleProp<ViewStyle>;
}

/**
 * A formatting toolbar that takes `editor` + `editorState` as explicit props
 * (no `useBridgeState` / `useKeyboard` from tentap).
 *
 * Designed for use with non-TipTap editors (e.g. react-native-enriched) that
 * supply their own bridge adapter and reactive state.
 */
const FormattingToolbar = memo(
  ({ editor, editorState, hidden, items, style }: FormattingToolbarProps) => {
    const [toolbarContext, setToolbarContext] = React.useState<ToolbarContext>(
      ToolbarContext.Main
    );
    const tamagui = useTheme();
    const isDark = useIsDarkTheme();

    const bgColor = tamagui.background.val;

    const staticStyles = useMemo(
      () =>
        StyleSheet.create({
          flatList: {
            backgroundColor: bgColor,
            borderTopWidth: 0,
            borderBottomWidth: 0,
          },
        }),
      [bgColor]
    );

    const args = useMemo(
      () => ({ editor, editorState, setToolbarContext, toolbarContext }),
      [editor, editorState, toolbarContext]
    );

    const createItemViewStyle = useCallback(
      (item: ToolbarItem) => {
        const isActive = item.active(args);
        const isDisabled = item.disabled(args);
        return [
          isActive
            ? {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.15)'
                  : 'rgba(0,0,0,0.1)',
                borderRadius: 6,
              }
            : undefined,
          isDisabled ? { opacity: 0.3 } : undefined,
        ];
      },
      [args, isDark]
    );

    const renderItem: ListRenderItem<ToolbarItem> = useCallback(
      ({ item }) => {
        const viewStyle = createItemViewStyle(item);
        return (
          <TouchableOpacity
            onPress={item.onPress(args)}
            disabled={item.disabled(args)}
            style={{ paddingHorizontal: 8, paddingVertical: 6 }}
            key={item.icon}
          >
            <View style={viewStyle}>
              <Icon type={item.icon} color="$primaryText" />
            </View>
          </TouchableOpacity>
        );
      },
      [args, createItemViewStyle]
    );

    const toolbarStyles = useMemo(
      () => [
        staticStyles.flatList,
        hidden ? { display: 'none' as const } : undefined,
        style,
      ],
      [hidden, staticStyles.flatList, style]
    );

    if (toolbarContext === ToolbarContext.Link) {
      return (
        <LinkBar
          backgroundColor={bgColor}
          onSubmit={(url) => {
            editor.setLink(url);
            editor.focus();
            setToolbarContext(ToolbarContext.Main);
          }}
          onCancel={() => {
            setToolbarContext(ToolbarContext.Main);
            editor.focus();
          }}
        />
      );
    }

    const data =
      toolbarContext === ToolbarContext.Main ? items : HEADING_ITEMS;

    return (
      <FlatList
        data={data}
        style={toolbarStyles}
        renderItem={renderItem}
        horizontal
        removeClippedSubviews
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        getItemLayout={(_, index) => ({
          length: 43,
          offset: 43 * index,
          index,
        })}
      />
    );
  }
);

FormattingToolbar.displayName = 'FormattingToolbar';

/** Simple inline link URL input bar. */
function LinkBar({
  backgroundColor,
  onSubmit,
  onCancel,
}: {
  backgroundColor: string;
  onSubmit: (url: string) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState('');

  return (
    <XStack
      alignItems="center"
      backgroundColor={backgroundColor}
      paddingHorizontal="$s"
      paddingVertical="$xs"
      gap="$s"
    >
      <TouchableOpacity onPress={onCancel}>
        <Icon type="Close" color="$primaryText" />
      </TouchableOpacity>
      <Input
        flex={1}
        value={url}
        onChangeText={setUrl}
        placeholder="https://..."
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        borderWidth={0}
        backgroundColor={backgroundColor}
        height={36}
        fontSize={14}
        padding={0}
        onSubmitEditing={() => url && onSubmit(url)}
      />
      <TouchableOpacity
        onPress={() => url && onSubmit(url)}
        disabled={!url}
        style={{ opacity: url ? 1 : 0.4, paddingHorizontal: 8 }}
      >
        <Text size="$label/m" color="$positiveActionText" fontWeight="600">
          Insert
        </Text>
      </TouchableOpacity>
    </XStack>
  );
}

export { FormattingToolbar };
