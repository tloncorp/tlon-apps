import { Close } from '../../assets/icons';
import { useReferences } from '../../contexts/references';
import { View, XStack, YStack } from '../../core';
import { ContentReference } from '../ContentReference/ContentReference';
import { IconButton } from '../IconButton';

export default function ReferencePreview({
  containerHeight,
}: {
  containerHeight: number;
}) {
  const { references, setReferences } = useReferences();
  return Object.keys(references).length ? (
    <YStack
      gap="$s"
      width="100%"
      position="absolute"
      bottom={containerHeight + 4}
      zIndex={10}
      backgroundColor="$background"
    >
      {Object.keys(references).map((ref) =>
        references[ref] !== null ? (
          <XStack
            left={15}
            position="relative"
            key={ref}
            width="100%"
            height="auto"
          >
            <ContentReference
              viewMode="attachment"
              reference={references[ref]!}
              key={ref}
            />
            <View position="absolute" top={4} right={36}>
              <IconButton
                onPress={() => {
                  setReferences({ ...references, [ref]: null });
                }}
                color="$primaryText"
              >
                <Close />
              </IconButton>
            </View>
          </XStack>
        ) : null
      )}
    </YStack>
  ) : null;
}
