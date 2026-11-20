import { IconType, useIsWindowNarrow } from '@tloncorp/ui';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { YStack } from 'tamagui';

import type { ActionGroup } from '../ActionSheet';
import { ActionSheet } from '../ActionSheet';
import { ListItem } from '../ListItem';

export function NotesActionMenu({
  groups,
  header,
  onAction,
  open,
  onOpenChange,
  onNativeDismissed,
  bottomContent,
  trigger,
}: {
  groups: ActionGroup[];
  header?: {
    icon: IconType;
    subtitle?: string;
    title: string;
  };
  // Off web the menu is a native sheet, so the caller decides when the chosen
  // action runs: anything that presents must wait for `onNativeDismissed`.
  onAction: (action?: () => void) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNativeDismissed?: () => void;
  // Rendered below the action list, outside the dismiss-on-press wrapper —
  // for rows that must keep the sheet open, e.g. inline toggles.
  bottomContent?: ReactNode;
  trigger: ReactNode;
}) {
  const isWindowNarrow = useIsWindowNarrow();

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      onNativeDismissed={onNativeDismissed}
      mode={Platform.OS === 'web' ? 'popover' : 'sheet'}
      modal
      snapPointsMode="fit"
      trigger={trigger}
      compact={!header && !bottomContent}
    >
      {header && isWindowNarrow ? (
        <ActionSheet.Header leadingIcon>
          <ListItem.SystemIcon icon={header.icon} />
          {/* The full title, however long: the rows that open this menu
              truncate it, so this is the one place to read all of it. */}
          <YStack
            flex={1}
            minWidth={0}
            minHeight="$4xl"
            justifyContent="space-evenly"
            gap="$xs"
          >
            <ListItem.Title numberOfLines={0}>{header.title}</ListItem.Title>
            {header.subtitle ? (
              <ListItem.Subtitle $gtSm={{ maxWidth: '100%' }}>
                {header.subtitle}
              </ListItem.Subtitle>
            ) : null}
          </YStack>
        </ActionSheet.Header>
      ) : null}
      <ActionSheet.Content>
        <NotesActionGroupList groups={groups} onAction={onAction} />
        {bottomContent}
      </ActionSheet.Content>
    </ActionSheet>
  );
}

export function NotesActionGroupList({
  groups,
  onAction,
}: {
  groups: ActionGroup[];
  onAction: (action?: () => void) => void;
}) {
  return groups.map((group, index) => (
    <ActionSheet.ActionGroup key={index} accent={group.accent}>
      {group.actions.map((action) => (
        <ActionSheet.Action
          key={action.title}
          action={{
            ...action,
            action: () => {
              onAction(action.action);
            },
          }}
          testID={action.testID}
        />
      ))}
    </ActionSheet.ActionGroup>
  ));
}
