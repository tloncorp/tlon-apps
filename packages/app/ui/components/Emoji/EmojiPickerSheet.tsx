import { FlashList } from '@shopify/flash-list';
import { createDevLogger } from '@tloncorp/shared';
import {
  Button,
  Sheet,
  SizableEmoji,
  getNativeEmoji,
  searchEmojis,
  useIsWindowNarrow,
  usePreloadedEmojis,
} from '@tloncorp/ui';
import React, {
  ComponentProps,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FlatList, Keyboard } from 'react-native';
import { Dialog, View, VisuallyHidden } from 'tamagui';

import { ActionSheet } from '../ActionSheet';
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

  const onTouchStart = useCallback(() => {
    setIsScrolling(true);
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
    <ActionSheet
      open={props.open ?? false}
      onOpenChange={(open: boolean) => props.onOpenChange?.(open)}
      snapPointsMode="percent"
      snapPoints={[snapToLarge ? 80 : 60]}
      {...rest}
      dismissOnSnapToBottom
      dismissOnOverlayPress
      animation="quick"
      disableDrag={scrolling}
      modal
    >
      <ActionSheet.Content>
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
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            data={listData}
            keyExtractor={keyExtractor}
            numColumns={6}
            renderItem={renderItem}
          />
        </View>
      </ActionSheet.Content>
    </ActionSheet>
  );
}
