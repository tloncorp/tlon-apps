import { useBridgeState, useKeyboard } from '@10play/tentap-editor';
import { Icon } from '@tloncorp/ui';
import React, { memo, useCallback, useMemo } from 'react';
import {
  FlatList,
  ListRenderItem,
  Platform,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { View, useTheme } from 'tamagui';

import { EditLinkBar } from './EditLinkBar';
import {
  DEFAULT_TOOLBAR_ITEMS,
  HEADING_ITEMS,
  TlonBridgeState,
  TlonEditorBridge,
  ToolbarContext,
  type ToolbarItem,
} from './toolbarActions';

interface ToolbarProps {
  editor: TlonEditorBridge;
  hidden?: boolean;
  items?: ToolbarItem[];
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
}

const createStaticStyles = (backgroundColor: string) =>
  StyleSheet.create({
    flatList: {
      backgroundColor,
      borderTopWidth: 0,
      borderBottomWidth: 0,
    },
    touchable: {
      backgroundColor: 'transparent',
    },
  });

const InputToolbar = memo(
  ({
    editor,
    hidden = undefined,
    items = DEFAULT_TOOLBAR_ITEMS,
    backgroundColor,
    style,
  }: ToolbarProps) => {
    const editorState = useBridgeState(editor) as TlonBridgeState;
    const { isKeyboardUp } = useKeyboard();
    const [toolbarContext, setToolbarContext] = React.useState<ToolbarContext>(
      ToolbarContext.Main
    );
    const tamagui = useTheme();

    const bgColor = backgroundColor || tamagui.background.val;
    console.log('bgColor', bgColor, 'toolbar', editor.theme.toolbar);
    const staticStyles = useMemo(() => createStaticStyles(bgColor), [bgColor]);

    const hideToolbar =
      hidden === undefined ? !isKeyboardUp || !editorState.isFocused : hidden;

    const itemIsActive = useCallback(
      (item: ToolbarItem) => {
        const args = {
          editor,
          editorState,
          setToolbarContext,
          toolbarContext,
        };

        return item.active(args);
      },
      [editor, editorState, setToolbarContext, toolbarContext]
    );

    const itemIsDisabled = useCallback(
      (item: ToolbarItem) => {
        const args = {
          editor,
          editorState,
          setToolbarContext,
          toolbarContext,
        };

        return item.disabled(args);
      },
      [editor, editorState, setToolbarContext, toolbarContext]
    );

    const createItemViewStyle = useCallback(
      (item: ToolbarItem) => [
        editor.theme.toolbar.toolbarButton,
        itemIsActive(item) ? editor.theme.toolbar.iconWrapperActive : undefined,
        itemIsDisabled(item)
          ? editor.theme.toolbar.iconWrapperDisabled
          : undefined,
      ],
      [editor, itemIsActive, itemIsDisabled]
    );

    const touchableStyle = useMemo(
      () => [editor.theme.toolbar.toolbarButton, staticStyles.touchable],
      [editor.theme.toolbar.toolbarButton, staticStyles.touchable]
    );

    const renderItem: ListRenderItem<ToolbarItem> = useCallback(
      ({ item: { onPress, disabled, active, icon } }) => {
        const args = {
          editor,
          editorState,
          setToolbarContext,
          toolbarContext,
        };

        const style = createItemViewStyle({ onPress, disabled, active, icon });

        return (
          <TouchableOpacity
            onPress={onPress(args)}
            disabled={disabled(args)}
            style={touchableStyle}
            key={icon}
          >
            <View style={style}>
              <Icon type={icon} color="$primaryText" />
            </View>
          </TouchableOpacity>
        );
      },
      [
        editor,
        editorState,
        setToolbarContext,
        toolbarContext,
        createItemViewStyle,
        touchableStyle,
      ]
    );

    const toolbarStyles = useMemo(() => {
      return [
        editor.theme.toolbar.toolbarBody,
        hideToolbar ? editor.theme.toolbar.hidden : undefined,
        staticStyles.flatList,
        { borderTopWidth: 0, borderBottomWidth: 0 },
        style,
      ];
    }, [editor.theme.toolbar, hideToolbar, staticStyles.flatList, style]);

    switch (toolbarContext) {
      case ToolbarContext.Main:
      case ToolbarContext.Heading:
        return (
          <FlatList
            data={
              toolbarContext === ToolbarContext.Main ? items : HEADING_ITEMS
            }
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
      case ToolbarContext.Link: {
        // TypeScript workaround - cast props to any to avoid type error from mismatched definition
        const linkBarProps: any = {
          theme: editor.theme,
          initialLink: editorState.activeLink,
          onBlur: () => setToolbarContext(ToolbarContext.Main),
          onLinkIconClick: () => {
            setToolbarContext(ToolbarContext.Main);
            editor.focus();
          },
          onEditLink: (link: string) => {
            editor.setLink(link);
            editor.focus();

            if (Platform.OS === 'android') {
              // On android we dont want to hide the link input before we finished focus on editor
              // Add here 100ms and we can try to find better solution later
              setTimeout(() => {
                setToolbarContext(ToolbarContext.Main);
              }, 100);
            } else {
              setToolbarContext(ToolbarContext.Main);
            }
          },
          backgroundColor: bgColor,
        };

        return <EditLinkBar {...linkBarProps} />;
      }
    }
  }
);

InputToolbar.displayName = 'InputToolbar';

export { InputToolbar };
