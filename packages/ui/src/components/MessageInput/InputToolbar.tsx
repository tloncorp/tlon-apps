// import React, { memo, useCallback, useMemo } from 'react';
// import {
// FlatList,
// ListRenderItem,
// Platform,
// TouchableOpacity,
// } from 'react-native';
import { Text, View } from '../../core';

// import { Icon } from '../Icon';
// import { EditLinkBar } from './EditLinkBar';

// import {
// DEFAULT_TOOLBAR_ITEMS,
// HEADING_ITEMS,
// TlonBridgeState,
// TlonEditorBridge,
// ToolbarContext,
// type ToolbarItem,
// } from './toolbarActions';

// interface ToolbarProps {
// editor: TlonEditorBridge;
// hidden?: boolean;
// items?: ToolbarItem[];
// }

// const InputToolbar = memo(
// ({
// editor,
// hidden = undefined,
// items = DEFAULT_TOOLBAR_ITEMS,
// }: ToolbarProps) => {
// const editorState = {} as TlonBridgeState;
// const { isKeyboardUp } = { isKeyboardUp: false };
// const [toolbarContext, setToolbarContext] = React.useState<ToolbarContext>(
// ToolbarContext.Main
// );

// const hideToolbar =
// hidden === undefined ? !isKeyboardUp || !editorState.isFocused : hidden;

// const itemIsActive = useCallback(
// (item: ToolbarItem) => {
// const args = {
// editor,
// editorState,
// setToolbarContext,
// toolbarContext,
// };

// return item.active(args);
// },
// [editor, editorState, setToolbarContext, toolbarContext]
// );

// const itemIsDisabled = useCallback(
// (item: ToolbarItem) => {
// const args = {
// editor,
// editorState,
// setToolbarContext,
// toolbarContext,
// };

// return item.disabled(args);
// },
// [editor, editorState, setToolbarContext, toolbarContext]
// );

// const createItemViewStyle = useCallback(
// (item: ToolbarItem) => [
// editor.theme.toolbar.toolbarButton,
// itemIsActive(item) ? editor.theme.toolbar.iconWrapperActive : undefined,
// itemIsDisabled(item)
// ? editor.theme.toolbar.iconWrapperDisabled
// : undefined,
// ],
// [editor, itemIsActive, itemIsDisabled]
// );

// const touchableStyle = useMemo(
// () => editor.theme.toolbar.toolbarButton,
// [editor.theme.toolbar.toolbarButton]
// );

// const renderItem: ListRenderItem<ToolbarItem> = useCallback(
// ({ item: { onPress, disabled, active, icon } }) => {
// const args = {
// editor,
// editorState,
// setToolbarContext,
// toolbarContext,
// };

// const style = createItemViewStyle({ onPress, disabled, active, icon });

// return (
// <TouchableOpacity
// onPress={onPress(args)}
// disabled={disabled(args)}
// style={touchableStyle}
// key={icon}
// >
// <View style={style}>
// <Icon type={icon} />
// </View>
// </TouchableOpacity>
// );
// },
// [
// editor,
// editorState,
// setToolbarContext,
// toolbarContext,
// createItemViewStyle,
// touchableStyle,
// ]
// );

// switch (toolbarContext) {
// case ToolbarContext.Main:
// case ToolbarContext.Heading:
// return (
// <FlatList
// data={
// toolbarContext === ToolbarContext.Main ? items : HEADING_ITEMS
// }
// style={[
// editor.theme.toolbar.toolbarBody,
// hideToolbar ? editor.theme.toolbar.hidden : undefined,
// ]}
// renderItem={renderItem}
// horizontal
// removeClippedSubviews
// initialNumToRender={6}
// maxToRenderPerBatch={6}
// getItemLayout={(_, index) => ({
// length: 43,
// offset: 43 * index,
// index,
// })}
// />
// );
// case ToolbarContext.Link:
// return (
// <EditLinkBar
// theme={editor.theme}
// initialLink={editorState.activeLink}
// onBlur={() => setToolbarContext(ToolbarContext.Main)}
// onLinkIconClick={() => {
// setToolbarContext(ToolbarContext.Main);
// editor.focus();
// }}
// onEditLink={(link) => {
// editor.setLink(link);
// editor.focus();

// if (Platform.OS === 'android') {
// // On android we dont want to hide the link input before we finished focus on editor
// // Add here 100ms and we can try to find better solution later
// setTimeout(() => {
// setToolbarContext(ToolbarContext.Main);
// }, 100);
// } else {
// setToolbarContext(ToolbarContext.Main);
// }
// }}
// />
// );
// }
// }
// );

// InputToolbar.displayName = 'InputToolbar';

const InputToolbar = () => {
  return (
    <View>
      <Text>InputToolbar</Text>
    </View>
  );
};

export { InputToolbar };
