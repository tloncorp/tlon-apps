import { createDevLogger } from '@tloncorp/shared';
import {
  Button,
  SizableEmoji,
  getNativeEmoji,
  searchEmojis,
  usePreloadedEmojis,
} from '@tloncorp/ui';
import React, { ComponentProps, useCallback, useMemo, useState } from 'react';
import { FlatList } from 'react-native';

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
  props: ComponentProps<typeof ActionSheet> & {
    onEmojiSelect: (value: string) => void;
  }
) {
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
      title="Emoji Picker"
      snapPointsMode="percent"
      snapPoints={[snapToLarge ? 80 : 60]}
      dialogContentProps={{
        width: 350,
        height: 600,
        padding: '$m',
      }}
      dismissOnSnapToBottom
      dismissOnOverlayPress
      animation="quick"
      modal
      {...rest}
    >
      <ActionSheet.Content padding="$m" flex={1}>
        <SearchBar
          debounceTime={300}
          marginHorizontal="$m"
          onChangeQuery={handleQueryChange}
          onFocus={handleInputFocus}
          inputProps={{ spellCheck: false, autoComplete: 'off' }}
        />
        <FlatList
          style={{ width: '100%' }}
          horizontal={false}
          contentContainerStyle={{ flexGrow: 1 }}
          data={listData}
          keyExtractor={keyExtractor}
          numColumns={6}
          renderItem={renderItem}
          renderScrollComponent={(props) => (
            <ActionSheet.ScrollableContent
              {...(props as ComponentProps<
                typeof ActionSheet.ScrollableContent
              >)}
            />
          )}
        />
      </ActionSheet.Content>
    </ActionSheet>
  );
}
