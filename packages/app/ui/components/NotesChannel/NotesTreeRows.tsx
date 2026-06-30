import * as db from '@tloncorp/shared/db';
import { Icon, Pressable } from '@tloncorp/ui';
import type { IconType } from '@tloncorp/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { TamaguiWebElement, XStack } from 'tamagui';

import { useSheetCloseAfterAnimation } from '../../hooks/useSheetCloseAfterAnimation';
import type { ActionGroup } from '../ActionSheet';
import { createActionGroups } from '../ActionSheet';
import { ListItem } from '../ListItem';
import { OverflowTriggerButton } from '../OverflowMenuButton';
import { NotesActionMenu } from './NotesCommon';

const TREE_ROW_HEIGHT = 44;
const TREE_LEVEL_WIDTH = 24;
const FOLDER_ROW_LEFT_PADDING = 5.5;

export function FolderTreeRow({
  canEdit,
  depth,
  expanded,
  folder,
  hasChildren,
  isDeleting,
  label,
  noteCount,
  onDelete,
  onCreateFolder,
  onCreateNote,
  onMove,
  onPress,
  onRename,
}: {
  canEdit: boolean;
  depth: number;
  expanded: boolean;
  folder: db.NotesFolder;
  hasChildren: boolean;
  isDeleting: boolean;
  label: string;
  noteCount: number;
  selected: boolean;
  onDelete: (folder: db.NotesFolder) => void;
  onCreateFolder: (folder: db.NotesFolder) => void;
  onCreateNote: (folder: db.NotesFolder) => void;
  onMove: (folder: db.NotesFolder) => void;
  onPress: () => void;
  onRename: (folder: db.NotesFolder) => void;
}) {
  const actionGroups = createActionGroups(
    [
      'neutral',
      {
        title: 'New note',
        startIcon: 'ChannelNote',
        action: () => onCreateNote(folder),
        testID: 'NotesCreateNoteInFolderAction',
      },
      {
        title: 'New folder',
        startIcon: 'Folder',
        action: () => onCreateFolder(folder),
        testID: 'NotesCreateFolderInFolderAction',
      },
    ],
    [
      'neutral',
      {
        title: 'Rename folder',
        startIcon: 'EditList',
        action: () => onRename(folder),
        testID: 'NotesRenameFolderAction',
      },
      {
        title: 'Move folder',
        startIcon: 'Folder',
        action: () => onMove(folder),
        testID: 'NotesMoveFolderAction',
      },
    ],
    [
      'negative',
      {
        title: 'Delete folder',
        startIcon: 'Trash',
        action: () => onDelete(folder),
        disabled: isDeleting,
        testID: 'NotesDeleteFolderAction',
      },
    ]
  );
  const { actionsMenu, rowActionProps } = useRowActions({
    actionGroups,
    canEdit,
    header: {
      icon: 'Folder',
      title: label,
      subtitle: noteCount > 0 ? formatNoteCount(noteCount) : 'Folder',
    },
  });

  return (
    <TreeRowFrame
      depth={depth}
      {...rowActionProps}
      onPress={onPress}
      testID={`NotesFolderRow-${label}`}
    >
      <TreeChevron expanded={expanded} hasChildren={hasChildren} />
      <ListItem.MainContent height="auto" minHeight={0}>
        <ListItem.Title
          size="$body"
          color="$primaryText"
          fontWeight="400"
          letterSpacing={0}
        >
          {label}
        </ListItem.Title>
      </ListItem.MainContent>
      {actionsMenu ? (
        <ListItem.EndContent paddingTop={0}>
          <XStack alignItems="center" gap="$xs">
            {actionsMenu}
          </XStack>
        </ListItem.EndContent>
      ) : null}
    </TreeRowFrame>
  );
}

export function NoteRow({
  canEdit,
  depth,
  note,
  selected = false,
  onDelete,
  onMove,
  onPress,
  onRename,
}: {
  canEdit: boolean;
  depth: number;
  note: db.NotesNote;
  selected?: boolean;
  onDelete: () => void;
  onMove: () => void;
  onPress: () => void;
  onRename: () => void;
}) {
  const updatedAt = getNoteTimestampMs(note.updatedAt ?? note.createdAt);
  const bodyPreview = getNoteBodyPreview(note.bodyMd);

  const actionGroups = createActionGroups(
    [
      'neutral',
      {
        title: 'Rename note',
        startIcon: 'EditList',
        action: onRename,
        testID: `NotesRenameNoteAction-${note.noteId}`,
      },
      {
        title: 'Move to folder',
        startIcon: 'Folder',
        action: onMove,
        testID: `NotesMoveNoteAction-${note.noteId}`,
      },
    ],
    canEdit && [
      'negative',
      {
        title: 'Delete note',
        startIcon: 'Trash',
        action: onDelete,
        testID: `NotesDeleteNoteAction-${note.noteId}`,
      },
    ]
  );
  const { actionsMenu, rowActionProps } = useRowActions({
    actionGroups,
    canEdit,
    header: {
      icon: 'ChannelNote',
      title: note.title || 'Untitled',
      subtitle: bodyPreview || 'Note',
    },
  });

  return (
    <TreeRowFrame
      depth={depth}
      selected={selected}
      variant="chatList"
      {...rowActionProps}
      onPress={onPress}
      testID={`NotesNoteRow-${note.noteId}`}
    >
      <ListItem.SystemIcon icon="ChannelNote" />
      <ListItem.MainContent>
        <ListItem.Title
          size="$body"
          color="$primaryText"
          fontWeight="400"
          letterSpacing={0}
        >
          {note.title || 'Untitled'}
        </ListItem.Title>
        {bodyPreview ? (
          <ListItem.Subtitle>{bodyPreview}</ListItem.Subtitle>
        ) : null}
      </ListItem.MainContent>
      {updatedAt || actionsMenu ? (
        <ListItem.EndContent>
          <XStack alignItems="center" gap="$xs">
            {updatedAt ? (
              <ListItem.Time time={updatedAt} letterSpacing={0} />
            ) : null}
            {actionsMenu}
          </XStack>
        </ListItem.EndContent>
      ) : null}
    </TreeRowFrame>
  );
}

function useRowActions({
  actionGroups,
  canEdit,
  header,
}: {
  actionGroups: ActionGroup[];
  canEdit: boolean;
  header: {
    icon: IconType;
    subtitle?: string;
    title: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { closeAfterAnimation, cancel: cancelPendingAction } =
    useSheetCloseAfterAnimation();
  const openActions = () => {
    if (canEdit) {
      cancelPendingAction();
      setOpen(true);
    }
  };
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        cancelPendingAction();
      }
      setOpen(nextOpen);
    },
    [cancelPendingAction]
  );
  const handleAction = useCallback(
    (action?: () => void) => {
      if (Platform.OS === 'web') {
        setOpen(false);
        action?.();
        return;
      }

      setOpen(false);
      closeAfterAnimation(() => action?.());
    },
    [closeAfterAnimation]
  );
  const hoverProps =
    Platform.OS === 'web'
      ? {
          onMouseEnter: () => setIsHovered(true),
          onMouseLeave: () => setIsHovered(false),
        }
      : {};
  const actionsTrigger =
    canEdit && Platform.OS === 'web' && (open || isHovered) ? (
      <OverflowTriggerButton
        paddingHorizontal="$xs"
        paddingVertical="$xs"
        marginRight="$-xs"
        onPress={(event) => {
          event.stopPropagation();
          setOpen((currentOpen) => !currentOpen);
        }}
      />
    ) : null;

  return {
    actionsMenu:
      canEdit && (open || actionsTrigger) ? (
        <NotesActionMenu
          groups={actionGroups}
          header={header}
          open={open}
          onAction={handleAction}
          onOpenChange={handleOpenChange}
          trigger={actionsTrigger}
        />
      ) : null,
    rowActionProps: {
      ...hoverProps,
      onOpenMenu: canEdit ? openActions : undefined,
    },
  };
}

function TreeChevron({
  expanded,
  hasChildren,
}: {
  expanded: boolean;
  hasChildren: boolean;
}) {
  return (
    <XStack
      width="$2xl"
      height="$2xl"
      alignItems="center"
      justifyContent="center"
    >
      {hasChildren ? (
        <Icon
          type={expanded ? 'ChevronDown' : 'ChevronRight'}
          size="$m"
          color="$tertiaryText"
        />
      ) : null}
    </XStack>
  );
}

function TreeRowFrame({
  children,
  depth,
  onPress,
  onOpenMenu,
  onMouseEnter,
  onMouseLeave,
  selected = false,
  testID,
  variant = 'compact',
}: {
  children: ReactNode;
  depth: number;
  onPress: () => void;
  onOpenMenu?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  selected?: boolean;
  testID?: string;
  variant?: 'compact' | 'chatList';
}) {
  const chatListStyle = variant === 'chatList';

  return (
    <TreeRowPressable
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onOpenMenu={onOpenMenu}
      onPress={onPress}
      testID={testID}
    >
      <ListItem
        alignItems={chatListStyle ? 'stretch' : 'center'}
        minHeight={chatListStyle ? undefined : TREE_ROW_HEIGHT}
        position="relative"
        borderRadius={chatListStyle ? '$xl' : '$m'}
        backgroundColor={
          selected
            ? chatListStyle
              ? '$shadow'
              : '$secondaryBackground'
            : 'transparent'
        }
        paddingLeft={chatListStyle ? '$l' : FOLDER_ROW_LEFT_PADDING}
        paddingRight={chatListStyle ? '$l' : '$s'}
        paddingVertical={chatListStyle ? '$l' : '$xs'}
        gap={chatListStyle ? '$l' : '$s'}
      >
        {depth > 0 ? (
          <XStack width={depth * TREE_LEVEL_WIDTH} flexShrink={0} />
        ) : null}
        {children}
      </ListItem>
    </TreeRowPressable>
  );
}

function TreeRowPressable({
  children,
  onPress,
  onOpenMenu,
  onMouseEnter,
  onMouseLeave,
  testID,
}: {
  children: ReactNode;
  onPress: () => void;
  onOpenMenu?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  testID?: string;
}) {
  const containerRef = useRef<TamaguiWebElement>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !onOpenMenu || !containerRef.current) {
      return;
    }

    const element = containerRef.current;
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      onOpenMenu();
    };

    element.addEventListener('contextmenu', handleContextMenu);
    return () => {
      element.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [onOpenMenu]);

  return (
    <Pressable
      ref={containerRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onLongPress={onOpenMenu}
      onPress={onPress}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}

function getNoteTimestampMs(timestamp: number | null | undefined) {
  if (!timestamp) return null;
  return timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
}

function getNoteBodyPreview(bodyMd: string | null | undefined) {
  const preview = (bodyMd ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^[\s>*+-]*\[[ x]\]\s+/gim, '')
    .replace(/^[\s>*+-]+/gm, '')
    .replace(/[*_~#|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return preview || null;
}

function formatNoteCount(noteCount: number) {
  return `${noteCount} ${noteCount === 1 ? 'note' : 'notes'}`;
}
