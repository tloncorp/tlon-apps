import type { ActionGroup } from './ActionSheet';
import type { IconMenuItem } from './IconMenu.types';

/**
 * An action sheet's groups as a native menu's commands. Actions the sheet
 * would grey out are left out, negative ones are marked destructive, and each
 * group after the first starts behind a separator.
 */
export function actionGroupsToMenuItems(groups: ActionGroup[]): IconMenuItem[] {
  const items: IconMenuItem[] = [];
  groups.forEach((group, groupIndex) => {
    // The same rule the sheet uses to grey a row out and ignore its press.
    const runnable = group.actions.filter(
      (action) =>
        action.action &&
        !action.disabled &&
        (action.accent ?? group.accent) !== 'disabled'
    );
    runnable.forEach((action, index) => {
      items.push({
        key: `${groupIndex}-${index}-${action.title}`,
        title: action.title,
        destructive: (action.accent ?? group.accent) === 'negative',
        separatorBefore: index === 0 && items.length > 0,
        onPress: action.action!,
      });
    });
  });
  return items;
}
