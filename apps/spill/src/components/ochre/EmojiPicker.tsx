import React, {useCallback, useMemo} from 'react';
import {ViewStyle, VirtualizedList} from 'react-native';
import {Emoji, emoji} from '@utils/emoji';
import {Text, XStack} from '@ochre';
import {styled} from 'tamagui';

export function EmojiPicker() {
  const columns = 6;
  const rows = Math.ceil(emoji.length / columns);

  const getItem = useCallback((data, index: number) => {
    return emoji.slice(index * columns, (index + 1) * columns);
  }, []);

  const getItemKey = useCallback((item: Emoji[]) => {
    return item[0]!.emoji;
  }, []);

  const getItemCount = useCallback(() => {
    return rows;
  }, [rows]);

  const renderItem = useCallback(({item}: {index: number; item: Emoji[]}) => {
    return <EmojiRow emojis={item} />;
  }, []);

  const listStyles: ViewStyle = useMemo(() => {
    return {flex: 1, backgroundColor: 'green', width: '100%'};
  }, []);

  return (
    <VirtualizedList
      style={listStyles}
      getItem={getItem}
      getItemCount={getItemCount}
      keyExtractor={getItemKey}
      renderItem={renderItem}
    />
  );
}

const EmojiRow = React.memo(({emojis}: {emojis: Emoji[]}) => {
  return (
    <XStack flex={1} justifyContent="center">
      {emojis.map(e => {
        return (
          <XStack padding="$m">
            <EmojiText key={e.emoji}>{e.emoji}</EmojiText>
          </XStack>
        );
      })}
    </XStack>
  );
});

const EmojiText = styled(Text, {
  fontSize: 32,
});
