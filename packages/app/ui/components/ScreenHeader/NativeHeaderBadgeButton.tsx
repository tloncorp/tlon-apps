import { Image, Pressable, Text, View } from 'react-native';

/**
 * A badged header button for iOS before 26, where UIBarButtonItem has no
 * badge and the native header ignores the property. Hosted as a custom native
 * header item, so it renders outside the app's providers: plain React Native,
 * with colours already resolved by the caller, and no module-level styling.
 */
export function NativeHeaderBadgeButton({
  iconUri,
  label,
  badge,
  tint,
  onPress,
  disabled,
  testID,
}: {
  iconUri: string;
  label: string;
  badge: number | string;
  tint?: string;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  const color = tint ?? '#8E8E93';
  const badgeText = String(badge).trim();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      testID={testID}
      hitSlop={4}
      style={{
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Image
        source={{ uri: iconUri }}
        resizeMode="contain"
        style={{ width: 24, height: 24, tintColor: color }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          minWidth: badgeText ? 16 : 10,
          height: badgeText ? 16 : 10,
          paddingHorizontal: badgeText ? 4 : 0,
          borderRadius: 8,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {badgeText ? (
          <Text
            numberOfLines={1}
            style={{
              color: '#FFFFFF',
              fontSize: 11,
              lineHeight: 13,
              fontWeight: '600',
            }}
          >
            {badgeText}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
