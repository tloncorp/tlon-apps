import { FlashList } from '@shopify/flash-list';
import { createDevLogger } from '@tloncorp/shared';
import { getNativeEmoji, useIsWindowNarrow } from '@tloncorp/ui';
import { Button } from '@tloncorp/ui';
import { KeyboardAvoidingView } from '@tloncorp/ui';
import { Sheet } from '@tloncorp/ui';
import { SizableEmoji } from '@tloncorp/ui';
import { searchEmojis, usePreloadedEmojis } from '@tloncorp/ui';
import { ComponentProps, useCallback, useMemo, useRef, useState } from 'react';
import React from 'react';
import {
  FlatList,
  Keyboard,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { View } from 'tamagui';
import { Dialog } from 'tamagui';
import { VisuallyHidden } from 'tamagui';

import { SearchBar } from '../SearchBar';

const EMOJI_SIZE = 32;
const logger = createDevLogger('EmojiPickerSheet', false);

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
      paddingHorizontal={0}
      flex={1 / 6}
      onPress={() => onSelect(item)}
      justifyContent="center"
      alignItems="center"
    >
      <SizableEmoji emojiInput={item} fontSize={EMOJI_SIZE} />
    </Button>
  );
});

export function EmojiPickerSheet(
  props: ComponentProps<typeof Sheet> & {
    onEmojiSelect: (value: string) => void;
  }
) {
  const [scrolling, setIsScrolling] = useState(false);
  const [snapToLarge, setSnapToLarge] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const { onEmojiSelect, ...rest } = props;
  const ALL_EMOJIS = usePreloadedEmojis();

  const listData = useMemo(() => {
    return query ? searchResults : ALL_EMOJIS;
  }, [query, searchResults, ALL_EMOJIS]);

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
    setTimeout(() => {
      props.onOpenChange?.(false);
    }, 100);
  }, [props]);

  const handleEmojiSelect = useCallback(
    (shortCode: string) => {
      const nativeEmoji = getNativeEmoji(shortCode);
      if (!nativeEmoji) {
        // should never hit this, but just in case
        logger.trackError(`No native emoji found`, { shortCode });
        return;
      }
      onEmojiSelect(nativeEmoji);
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

  const isWindowNarrow = useIsWindowNarrow();

  const keyExtractor = useCallback((item: string) => item, []);

  const hasOpened = useRef(props.open);
  if (!hasOpened.current && props.open) {
    hasOpened.current = true;
  }

  // Sheets are heavy; we don't want to render until we need to
  if (!hasOpened.current) return null;

  if (!isWindowNarrow) {
    return (
      <Dialog open={props.open} onOpenChange={props.onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay
            backgroundColor="$overlayBackground"
            key="overlay"
            opacity={0.4}
          />
          <Dialog.Content
            borderWidth={1}
            borderColor="$border"
            padding="$m"
            height={600}
            width={350}
            key="content"
          >
            <VisuallyHidden>
              <Dialog.Title>Emoji Picker</Dialog.Title>
            </VisuallyHidden>
            <View width="100%" marginBottom="$xl">
              <SearchBar
                debounceTime={300}
                marginHorizontal="$m"
                onChangeQuery={handleQueryChange}
                inputProps={{ spellCheck: false, autoComplete: 'off' }}
              />
            </View>
            <FlashList
              onScroll={handleScroll}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              data={listData}
              keyExtractor={keyExtractor}
              numColumns={6}
              removeClippedSubviews
              renderItem={renderItem}
              estimatedItemSize={48}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    );
  }

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
                debounceTime={300}
                marginHorizontal="$m"
                onChangeQuery={handleQueryChange}
                onFocus={handleInputFocus}
                inputProps={{ spellCheck: false, autoComplete: 'off' }}
              />
            </View>
            <View onTouchStart={() => Keyboard.dismiss()}>
              <FlatList
                style={{ width: '100%' }}
                horizontal={false}
                contentContainerStyle={{ flexGrow: 1 }}
                onScroll={handleScroll}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
                data={listData}
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
