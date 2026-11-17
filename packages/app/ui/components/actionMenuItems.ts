import type { ActionGroup } from './ActionSheet';
import type { IconMenuItem } from './IconMenu.types';

/**
 * An action sheet's groups as a native menu's commands. Actions that can't
 * run are left out, negative ones are marked destructive, and each group
 * after the first starts behind a separator.
 */
export function actionGroupsToMenuItems(groups: ActionGroup[]): IconMenuItem[] {
  const items: IconMenuItem[] = [];
  for (const group of groups) {
    const runnable = group.actions.filter(
      (action) => action.action && !action.disabled
    );
    runnable.forEach((action, index) => {
      items.push({
        key: action.title,
        title: action.title,
        destructive: (action.accent ?? group.accent) === 'negative',
        separatorBefore: index === 0 && items.length > 0,
        onPress: action.action!,
      });
    });
  }
  return items;
}
