import { ComponentProps } from 'react';
import { FlatList, Modal } from 'react-native';

import { Button } from '../Button';
import { Sheet } from '../Sheet';
import { SizableEmoji } from './SizableEmoji';
import { ALL_EMOJIS } from './data';

export function EmojiPickerSheet(
  props: ComponentProps<typeof Sheet> & {
    onEmojiSelect: (shortCode: string) => void;
  }
) {
  const { onEmojiSelect, ...rest } = props;

  const handleEmojiSelect = (shortCode: string) => {
    onEmojiSelect(shortCode);
    props.onOpenChange?.(false);
  };

  return (
    <Modal
      transparent
      visible={props.open}
      onDismiss={() => props.onOpenChange?.(false)}
    >
      <Sheet
        zIndex={999999999999}
        snapPointsMode="percent"
        snapPoints={[60]}
        {...rest}
        dismissOnSnapToBottom
        dismissOnOverlayPress
        // @ts-ignore-next-line
        animation="quick"
      >
        <Sheet.Overlay />
        <Sheet.Frame padding="$xl" alignItems="center">
          <Sheet.Handle paddingBottom="$2xl" />
          <FlatList
            style={{ width: '100%' }}
            horizontal={false}
            contentContainerStyle={{}}
            data={ALL_EMOJIS}
            keyExtractor={(item) => item}
            numColumns={6}
            renderItem={({ item }) => (
              <Button
                borderWidth={0}
                flex={1}
                onPress={() => handleEmojiSelect(item)}
                justifyContent="center"
                alignItems="center"
              >
                <SizableEmoji shortCode={item} fontSize={32} />
              </Button>
            )}
          />
        </Sheet.Frame>
      </Sheet>
    </Modal>
  );
}
