import { ComponentProps, useCallback, useRef, useState } from 'react';
import React from 'react';
import {
  FlatList,
  Keyboard,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

import { View } from '../../core';
import { Button } from '../Button';
import KeyboardAvoidingView from '../KeyboardAvoidingView';
import { SearchBar } from '../SearchBar';
import { Sheet } from '../Sheet';
import { SizableEmoji } from './SizableEmoji';
import { ALL_EMOJIS, EmojiObject, searchEmojis } from './data';

const EMOJI_SIZE = 32;

const MemoizedEmojiButton = React.memo(function MemoizedEmojiButtonComponent({
  item,
  onSelect,
}: {
  item: string;
  onSelect: (shortCode: string) => void;
}) {
  return (
    <Button
      borderWidth={0}
      flex={1}
      onPress={() => onSelect(item)}
      justifyContent="center"
      alignItems="center"
    >
      <SizableEmoji shortCode={item} fontSize={EMOJI_SIZE} />
    </Button>
  );
});

export function EmojiPickerSheet(
  props: ComponentProps<typeof Sheet> & {
    onEmojiSelect: (shortCode: string) => void;
  }
) {
  const [scrolling, setIsScrolling] = useState(false);
  const [snapToLarge, setSnapToLarge] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const { onEmojiSelect, ...rest } = props;

  const handleQueryChange = useCallback((query: string) => {
    setQuery(query);
    setSearchResults(searchEmojis(query).map((emoj) => emoj.id));
  }, []);

  const handleInputFocus = useCallback(() => {
    setSnapToLarge(true);
  }, []);

  const handleDismiss = useCallback(() => {
    setQuery('');
    setIsScrolling(false);
    setSnapToLarge(false);
    props.onOpenChange?.(false);
  }, [props]);

  const handleEmojiSelect = useCallback(
    (shortCode: string) => {
      onEmojiSelect(shortCode);
      props.onOpenChange?.(false);
    },
    [onEmojiSelect, props]
  );

  const scrollPosition = useRef(0);
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollPosition.current = event.nativeEvent.contentOffset.y;
    },
    []
  );
  const onTouchStart = useCallback(() => {
    if (scrollPosition.current > 0) {
      setIsScrolling(true);
    }
  }, []);
  const onTouchEnd = useCallback(() => setIsScrolling(false), []);

  const renderItem = useCallback(
    ({ item }: { item: string }) => (
      <MemoizedEmojiButton item={item} onSelect={handleEmojiSelect} />
    ),
    [handleEmojiSelect]
  );

  const keyExtractor = useCallback((item: string) => item, []);

  return (
    <Modal transparent visible={props.open} onDismiss={handleDismiss}>
      <Sheet
        snapPointsMode="percent"
        snapPoints={[snapToLarge ? 80 : 60]}
        {...rest}
        dismissOnSnapToBottom
        dismissOnOverlayPress
        animation="quick"
        disableDrag={scrolling}
      >
        <Sheet.Overlay zIndex="$modalSheet" />
        <Sheet.Frame
          zIndex="$modalSheet"
          padding="$xl"
          alignItems="center"
          flex={1}
        >
          <KeyboardAvoidingView style={{ flex: 1, width: '100%' }}>
            <Sheet.Handle paddingBottom="$xl" />
            <View width="100%" marginBottom="$xl">
              <SearchBar
                debounceTime={100}
                marginHorizontal="$m"
                onChangeQuery={handleQueryChange}
                onFocus={handleInputFocus}
              />
            </View>
            <View onTouchStart={() => Keyboard.dismiss()}>
              <FlatList
                style={{ width: '100%' }}
                horizontal={false}
                contentContainerStyle={{}}
                onScroll={handleScroll}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
                data={query ? searchResults : ALL_EMOJIS}
                keyExtractor={keyExtractor}
                numColumns={6}
                renderItem={renderItem}
              />
            </View>
          </KeyboardAvoidingView>
        </Sheet.Frame>
      </Sheet>
    </Modal>
  );
}
