import { StyleSheet } from 'react-native';

import { useConversationScrollViewNativeID } from '../../contexts/scroll';
import { ScrollEdgeElementContainer } from '../ScrollEdgeElementContainer';

/**
 * Registers the transparent header's area as a top scroll edge element, so
 * the list's soft edge effect reaches down behind the title. The title is text
 * outside Liquid Glass and takes its contrast from that effect alone. On iOS
 * 27, an app built with the iOS 26 SDK gets a soft effect that stops at the
 * status bar unless an element extends it, as the floating pinned-post banner
 * does.
 */
export function HeaderScrollEdgeElement({ height }: { height: number }) {
  const scrollViewNativeID = useConversationScrollViewNativeID();

  return (
    <ScrollEdgeElementContainer
      edge="top"
      scrollViewNativeID={scrollViewNativeID}
      pointerEvents="none"
      style={[styles.container, { height }]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
