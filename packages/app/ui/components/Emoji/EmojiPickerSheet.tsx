import { FlashList } from '@shopify/flash-list';
import { createDevLogger } from '@tloncorp/shared';
import {
  Pressable,
  SizableEmoji,
  View,
  getNativeEmoji,
  searchEmojis,
  usePreloadedEmojis,
} from '@tloncorp/ui';
import React, { ComponentProps, useCallback, useMemo, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { getTokenValue } from 'tamagui';

import { useSheetCoveredHeight } from '../../hooks/useSheetCoveredHeight';
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
    <Pressable
      width="100%"
      height={EMOJI_ROW_HEIGHT}
      onPress={() => onSelect(item)}
      justifyContent="center"
      alignItems="center"
    >
      <SizableEmoji emojiInput={item} fontSize={EMOJI_SIZE} />
    </Pressable>
  );
});

// Its own component so that it reads the covered height from inside the sheet.
function NativeEmojiList({
  size,
  ...listProps
}: {
  size: { width: number; height: number };
  data: readonly string[];
  keyExtractor: (item: string) => string;
  renderItem: (info: { item: string }) => React.ReactElement;
}) {
  // On Android the list keeps its height while the keyboard slides over the
  // sheet, so it needs that much more room to scroll its last rows clear.
  const coveredHeight = useSheetCoveredHeight();
  const contentContainerStyle = useMemo(
    () => ({ paddingBottom: coveredHeight }),
    [coveredHeight]
  );
  return (
    <View style={size}>
      <FlashList
        {...listProps}
        numColumns={6}
        extraData={listProps.data}
        contentContainerStyle={contentContainerStyle}
        nestedScrollEnabled
      />
    </View>
  );
}

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
      transition="quick"
      modal
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
          <NativeEmojiList
            size={estimatedListSize}
            data={listData}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
          />
        </ActionSheet.Content>
      )}
    </ActionSheet>
  );
}
