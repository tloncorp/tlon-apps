import { BottomSheetFlashList } from '@gorhom/bottom-sheet';
import { FlashList } from '@shopify/flash-list';
import { createDevLogger } from '@tloncorp/shared';
import {
  Button,
  SizableEmoji,
  View,
  getNativeEmoji,
  searchEmojis,
  usePreloadedEmojis,
} from '@tloncorp/ui';
import React, { ComponentProps, useCallback, useMemo, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { getTokenValue } from 'tamagui';

import { ActionSheet } from '../ActionSheet';
import { SearchBar } from '../SearchBar';

const EMOJI_SIZE = 32;
const EMOJI_ROW_HEIGHT = EMOJI_SIZE + 16; // emoji size + padding
const logger = createDevLogger('EmojiPickerSheet', false);

const MemoizedEmojiButton = React.memo(function MemoizedEmojiButtonComponent({
  item,
  onSelect,
}: {
  item: string;
  onSelect: (shortCode: string) => void;
}) {
  return (
    <Button.Frame
      borderWidth={0}
      paddingHorizontal={0}
      width="100%"
      height={EMOJI_ROW_HEIGHT}
      onPress={() => onSelect(item)}
      justifyContent="center"
      alignItems="center"
    >
      <SizableEmoji emojiInput={item} fontSize={EMOJI_SIZE} />
    </Button.Frame>
  );
});

export function EmojiPickerSheet(
  props: ComponentProps<typeof ActionSheet> & {
    onEmojiSelect: (value: string) => void;
  }
) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const { onEmojiSelect, ...rest } = props;
  const ALL_EMOJIS = usePreloadedEmojis();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Estimate list container size to enable immediate rendering (native only)
  // Sheet is ~60% height (from snapPoints), minus search bar + handle + padding (~100px)
  const estimatedListSize = useMemo(() => {
    const horizontalPadding = getTokenValue('$m', 'space') * 2;
    return {
      width: screenWidth - horizontalPadding,
      height: screenHeight * 0.6 - 100,
    };
  }, [screenWidth, screenHeight]);

  const listData = useMemo(() => {
    return query ? searchResults : ALL_EMOJIS;
  }, [query, searchResults, ALL_EMOJIS]);

  const handleQueryChange = useCallback((query: string) => {
    setQuery(query);
    setSearchResults(searchEmojis(query).map((emoj) => emoj.id));
  }, []);

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

  const renderItem = useCallback(
    ({ item }: { item: string }) => (
      <MemoizedEmojiButton item={item} onSelect={handleEmojiSelect} />
    ),
    [handleEmojiSelect]
  );

  const keyExtractor = useCallback((item: string) => item, []);

  return (
    <ActionSheet
      snapPointsMode="percent"
      snapPoints={[60]}
      dialogContentProps={{
        width: 350,
        height: 600,
        padding: '$m',
      }}
      dismissOnSnapToBottom
      dismissOnOverlayPress
      animation="quick"
      modal
      hasScrollableContent={Platform.OS !== 'web'}
      {...rest}
    >
      {Platform.OS === 'web' ? (
        <ActionSheet.Content padding="$m" flex={1}>
          <SearchBar
            debounceTime={300}
            marginHorizontal="$m"
            onChangeQuery={handleQueryChange}
            inputProps={{ spellCheck: false, autoComplete: 'off' }}
          />
          <View style={{ height: 480, width: '100%' }}>
            <FlashList
              data={listData}
              keyExtractor={keyExtractor}
              numColumns={6}
              renderItem={renderItem}
              estimatedItemSize={EMOJI_ROW_HEIGHT}
            />
          </View>
        </ActionSheet.Content>
      ) : (
        <ActionSheet.Content padding="$m">
          <SearchBar
            debounceTime={300}
            marginHorizontal="$m"
            onChangeQuery={handleQueryChange}
            inputProps={{ spellCheck: false, autoComplete: 'off' }}
          />
          <View
            style={{
              height: estimatedListSize.height,
              width: estimatedListSize.width,
            }}
          >
            <BottomSheetFlashList
              data={listData}
              keyExtractor={keyExtractor}
              numColumns={6}
              renderItem={renderItem}
              extraData={listData}
              estimatedItemSize={EMOJI_ROW_HEIGHT}
              estimatedListSize={estimatedListSize}
            />
          </View>
        </ActionSheet.Content>
      )}
    </ActionSheet>
  );
}
