import { IconType, useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';

import type { ActionGroup } from '../ActionSheet';
import { ActionSheet } from '../ActionSheet';
import { ListItem } from '../ListItem';

export function NotesActionMenu({
  groups,
  header,
  onAction,
  open,
  onOpenChange,
  trigger,
}: {
  groups: ActionGroup[];
  header?: {
    icon: IconType;
    subtitle?: string;
    title: string;
  };
  onAction?: (action?: () => void) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
}) {
  const isWindowNarrow = useIsWindowNarrow();
  const handleAction = useCallback(
    (action?: () => void) => {
      if (onAction) {
        onAction(action);
      } else {
        onOpenChange(false);
        action?.();
      }
    },
    [onAction, onOpenChange]
  );

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      mode={Platform.OS === 'web' ? 'popover' : 'sheet'}
      modal
      snapPointsMode="fit"
      trigger={trigger}
    >
      {header && isWindowNarrow ? (
        <ActionSheet.Header>
          <ListItem.SystemIcon icon={header.icon} />
          <ActionSheet.ActionContent>
            <ListItem.Title>{header.title}</ListItem.Title>
            {header.subtitle ? (
              <ListItem.Subtitle $gtSm={{ maxWidth: '100%' }}>
                {header.subtitle}
              </ListItem.Subtitle>
            ) : null}
          </ActionSheet.ActionContent>
        </ActionSheet.Header>
      ) : null}
      <ActionSheet.Content>
        <NotesActionGroupList groups={groups} onAction={handleAction} />
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
