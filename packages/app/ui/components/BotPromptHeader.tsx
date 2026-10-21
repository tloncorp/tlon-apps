import { Text } from '@tloncorp/ui';
import { ComponentProps, ReactNode } from 'react';
import { XStack, YStack } from 'tamagui';

/**
 * What a prompt editor or prompt file is about: a title with the file name
 * or bot it belongs to beside it, and a line on what the text does. The
 * editor sheets and the file screen share it, so they read alike; the
 * screen leaves out the title its navigation bar already shows, and the
 * file name then follows the description.
 *
 * Text trims its line boxes to the glyphs, so a gap here is the whole
 * distance between one line's baseline and the next line's cap height:
 * `$l` puts the next line about a line-height down, as a list row spaces
 * its title and subtitle.
 */
export function BotPromptHeader({
  title,
  meta,
  description,
  ...props
}: Omit<ComponentProps<typeof YStack>, 'children'> & {
  title?: string;
  meta?: string;
  description: ReactNode;
}) {
  return (
    <YStack gap="$l" {...props}>
      {title ? (
        <XStack alignItems="baseline" gap="$l">
          <Text
            size="$label/xl"
            fontWeight="600"
            color="$primaryText"
            flex={1}
            minWidth={0}
            numberOfLines={1}
          >
            {title}
          </Text>
          {meta ? (
            <Text
              size="$label/m"
              color="$tertiaryText"
              flexShrink={0}
              numberOfLines={1}
            >
              {meta}
            </Text>
          ) : null}
        </XStack>
      ) : null}
      <Text size="$label/m" color="$secondaryText">
        {description}
      </Text>
      {!title && meta ? (
        <Text size="$label/m" color="$tertiaryText">
          {meta}
        </Text>
      ) : null}
    </YStack>
  );
}
