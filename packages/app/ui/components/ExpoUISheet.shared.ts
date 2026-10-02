import type { useTheme } from 'tamagui';

import type { Action, ActionGroup } from './ActionSheet';

type Theme = ReturnType<typeof useTheme>;

/** Row colors shared by the SwiftUI and Compose chat-options renderers. */
export function getActionRowStyle(
  theme: Theme,
  action: Action,
  groupAccent: ActionGroup['accent']
) {
  const accent = action.accent ?? groupAccent;
  return {
    accent,
    isDisabled:
      action.disabled ||
      action.accent === 'disabled' ||
      groupAccent === 'disabled',
    titleColor:
      accent === 'positive'
        ? theme.positiveActionText.val
        : accent === 'negative'
          ? theme.negativeActionText.val
          : accent === 'disabled'
            ? theme.tertiaryText.val
            : theme.primaryText.val,
    descriptionColor:
      accent === 'positive'
        ? theme.positiveActionText.val
        : accent === 'negative'
          ? theme.negativeActionText.val
          : theme.tertiaryText.val,
    iconColor:
      accent === 'positive'
        ? ('$positiveActionText' as const)
        : accent === 'negative'
          ? ('$negativeActionText' as const)
          : accent === 'disabled'
            ? ('$tertiaryText' as const)
            : ('$primaryText' as const),
    rowBackground:
      action.selected || accent === 'positive'
        ? theme.positiveBackground.val
        : accent === 'negative'
          ? theme.negativeBackground.val
          : undefined,
  };
}

export function getActionGroupBorderColor(
  theme: Theme,
  accent: ActionGroup['accent']
) {
  return accent === 'positive'
    ? theme.positiveBorder.val
    : accent === 'negative'
      ? theme.negativeBorder.val
      : accent === 'disabled'
        ? theme.secondaryBorder.val
        : theme.border.val;
}
