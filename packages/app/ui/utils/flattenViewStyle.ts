import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

// RN's generated flatten signature rejects void entries allowed by StyleProp.
export const flattenViewStyle = StyleSheet.flatten as (
  style: StyleProp<ViewStyle>
) => ViewStyle | undefined;
