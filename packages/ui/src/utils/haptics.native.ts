import * as Haptics from 'expo-haptics';

import { HapticAction } from './hapticIds';

export function triggerHaptic(action: HapticAction) {
  switch (action) {
    case 'baseButtonClick':
    case 'sheetOpen':
    case 'swipeAction':
      setTimeout(
        () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        10
      );
      break;
    case 'zoomable':
      setTimeout(
        () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
        10
      );
      break;
    case 'success':
      setTimeout(
        () =>
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
        10
      );
      break;
    case 'error':
      setTimeout(
        () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
        10
      );
      break;
    default:
      break;
  }
}
