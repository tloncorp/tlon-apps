import { Icon } from '@tloncorp/ui';
import type { ReactNode } from 'react';
import { Spinner, View, XStack, YStack } from 'tamagui';

import type { useImageInput } from './Form';
import { IconMenu } from './IconMenu';
import type { IconMenuItem } from './IconMenu.types';

/** The size of the picture being edited on an editor's first row. */
export const editorAvatar = { size: 96, radius: 22 } as const;

/** What can be done to a picture: replace it, or remove the one there is. */
export function imageMenuItems(
  image: ReturnType<typeof useImageInput>,
  removeTitle: string
): IconMenuItem[] {
  return [
    {
      key: 'library',
      title: 'Choose Photo',
      systemImage: 'photo.on.rectangle',
      onPress: image.pickFromLibrary,
    },
    {
      key: 'camera',
      title: 'Take Photo',
      systemImage: 'camera',
      onPress: image.takePhoto,
    },
    ...(image.assetUri
      ? [
          {
            key: 'remove',
            title: removeTitle,
            systemImage: 'trash',
            destructive: true,
            onPress: image.clear,
          },
        ]
      : []),
  ];
}

/**
 * A picture centered on its own row, with a camera in its corner. Pressing it
 * opens what can be done to it: a native menu on iOS and Android, the picker
 * sheet on web.
 */
export function IconEditor({
  avatar,
  isUploading,
  menuItems,
  onPressFallback,
  accessibilityLabel,
  notice,
  children,
}: {
  avatar: ReactNode;
  isUploading: boolean;
  menuItems: IconMenuItem[];
  onPressFallback: () => void;
  accessibilityLabel: string;
  notice?: ReactNode;
  /** More controls for the picture, under it. */
  children?: ReactNode;
}) {
  return (
    <YStack paddingTop="$l" gap="$l">
      {notice}
      <XStack justifyContent="center">
        <IconMenu
          items={menuItems}
          onPress={onPressFallback}
          accessibilityLabel={accessibilityLabel}
          testID="ImageInputPreview"
        >
          <View>
            <View opacity={isUploading ? 0.4 : 1}>{avatar}</View>
            {isUploading ? (
              <View
                position="absolute"
                top={0}
                right={0}
                bottom={0}
                left={0}
                alignItems="center"
                justifyContent="center"
              >
                <Spinner size="small" />
              </View>
            ) : null}
            {/* Inside the corner: the menu's hosted label clips anything
                hanging outside it. */}
            <View
              position="absolute"
              right={5}
              bottom={5}
              width={26}
              height={26}
              borderRadius={13}
              backgroundColor="$primaryText"
              borderWidth={2}
              borderColor="$background"
              alignItems="center"
              justifyContent="center"
            >
              <Icon type="Camera" size="$s" color="$background" />
            </View>
          </View>
        </IconMenu>
      </XStack>
      {children}
    </YStack>
  );
}
