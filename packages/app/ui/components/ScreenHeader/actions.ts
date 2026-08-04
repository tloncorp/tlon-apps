import type { ReactNode } from 'react';

/** Action declarations shared by content and native header renderers. */

export type ScreenHeaderIconName =
  | 'Add'
  | 'AddPerson'
  | 'ChevronLeft'
  | 'EditList'
  | 'Overflow'
  | 'Refresh'
  | 'RightSidebar'
  | 'Search'
  | 'Settings';

interface BaseAction {
  /** Stable identity for the action; also the default testID. */
  id: string;
  /** Excluded from every platform representation when false. */
  visible?: boolean;
}

export interface ScreenHeaderIconAction extends BaseAction {
  kind: 'icon';
  icon: ScreenHeaderIconName;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  selected?: boolean;
  /** Theme token (`$positiveActionText`) or raw color. */
  tint?: string;
  /** React-rendered header highlight behind the icon. */
  backgroundTint?: string;
  testID?: string;
}

export interface ScreenHeaderTextAction extends BaseAction {
  kind: 'text';
  text: string;
  onPress?: () => void;
  disabled?: boolean;
  tint?: string;
  testID?: string;
}

export interface ScreenHeaderMenuActionItem {
  id: string;
  label: string;
  onPress: () => void;
}

export interface ScreenHeaderMenuAction extends BaseAction {
  kind: 'menu';
  icon: ScreenHeaderIconName;
  label: string;
  items: ScreenHeaderMenuActionItem[];
}

export type ScreenHeaderAction =
  | ScreenHeaderIconAction
  | ScreenHeaderTextAction
  | ScreenHeaderMenuAction;

export interface UseScreenHeaderOptions {
  enabled: boolean;
  title: string;
  titleElement: ReactNode;
  usesCustomTitle: boolean;
  backgroundColor?: string;
  left: ScreenHeaderAction[];
  right: ScreenHeaderAction[];
}

export function visibleScreenHeaderActions(actions: ScreenHeaderAction[]) {
  return actions.filter((action) => action.visible !== false);
}

/**
 * Native header options are installed less often than React callbacks change.
 * Keep the installed wrappers stable while always dispatching to current data.
 */
export function forwardLatestScreenHeaderActionCallbacks(actionsRef: {
  current: ScreenHeaderAction[];
}): ScreenHeaderAction[] {
  return actionsRef.current.map((action) => {
    if (action.kind === 'menu') {
      const actionId = action.id;
      return {
        ...action,
        items: action.items.map((item) => {
          const itemId = item.id;
          return {
            ...item,
            onPress: () => {
              const latestAction = actionsRef.current.find(
                (candidate) =>
                  candidate.id === actionId && candidate.kind === 'menu'
              );
              if (latestAction?.kind === 'menu') {
                latestAction.items
                  .find((candidate) => candidate.id === itemId)
                  ?.onPress();
              }
            },
          };
        }),
      };
    }

    const actionId = action.id;
    const actionKind = action.kind;
    return {
      ...action,
      onPress: () => {
        const latestAction = actionsRef.current.find(
          (candidate) =>
            candidate.id === actionId && candidate.kind === actionKind
        );
        if (latestAction?.kind !== 'menu' && !latestAction?.disabled) {
          latestAction?.onPress?.();
        }
      },
    };
  });
}

/** Serializable state shared by native and React header renderers. */
export function getScreenHeaderActionPresentation(
  actions: ScreenHeaderAction[],
  resolveColor: (color: string | undefined) => string | undefined
) {
  return visibleScreenHeaderActions(actions).map((action) => {
    switch (action.kind) {
      case 'menu':
        return {
          kind: action.kind,
          id: action.id,
          icon: action.icon,
          label: action.label,
          items: action.items.map(({ id, label }) => ({ id, label })),
        };
      case 'text':
        return {
          kind: action.kind,
          id: action.id,
          text: action.text,
          disabled: action.disabled,
          tint: resolveColor(action.tint),
          testID: action.testID,
        };
      case 'icon':
        return {
          kind: action.kind,
          id: action.id,
          icon: action.icon,
          label: action.label,
          disabled: action.disabled,
          selected: action.selected,
          tint: resolveColor(action.tint),
          backgroundTint: resolveColor(action.backgroundTint),
          testID: action.testID,
        };
    }
  });
}

export function getScreenHeaderActionSignature(
  actions: ScreenHeaderAction[],
  resolveColor: (color: string | undefined) => string | undefined
) {
  return JSON.stringify(
    getScreenHeaderActionPresentation(actions, resolveColor)
  );
}
