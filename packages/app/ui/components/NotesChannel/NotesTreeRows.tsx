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
import { NotesActionMenu } from './NotesActions';
import { noteTimestampMs } from './notesTree';

type PublishingAction = 'publish' | 'unpublish' | null;

export function FolderTreeRow({
  canEdit,
  folder,
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
  folder: db.NotesFolder;
  isDeleting: boolean;
  label: string;
  noteCount: number;
  onDelete: (folder: db.NotesFolder) => void;
  onCreateFolder: (folder: db.NotesFolder) => void;
  onCreateNote: (folder: db.NotesFolder) => void;
  onMove: (folder: db.NotesFolder) => void;
  onPress: () => void;
  onRename: (folder: db.NotesFolder) => void;
}) {
  const subtitle = noteCount > 0 ? formatNoteCount(noteCount) : 'Folder';
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
      subtitle,
    },
  });

  return (
    <TreeRowFrame
      {...rowActionProps}
      onPress={onPress}
      testID={`NotesFolderRow-${label}`}
    >
      <ListItem.SystemIcon icon="Folder" />
      <ListItem.MainContent>
        <ListItem.Title
          size="$body"
          color="$primaryText"
          fontWeight="400"
          letterSpacing={0}
        >
          {label}
        </ListItem.Title>
        <ListItem.Subtitle>{subtitle}</ListItem.Subtitle>
      </ListItem.MainContent>
      <ListItem.EndContent>
        <XStack alignItems="center" gap="$xs">
          {actionsMenu}
          <Icon type="ChevronRight" color="$tertiaryText" size="$m" />
        </XStack>
      </ListItem.EndContent>
    </TreeRowFrame>
  );
}

export function NoteRow({
  canEdit,
  isPublished,
  note,
  publishDisabled,
  publishedUrl,
  publishingAction,
  selected = false,
  onDelete,
  onMove,
  onPress,
  onPublish,
  onRename,
  onUnpublish,
  onViewPublished,
}: {
  canEdit: boolean;
  isPublished: boolean;
  note: db.NotesNote;
  publishDisabled: boolean;
  publishedUrl?: string | null;
  publishingAction: PublishingAction;
  selected?: boolean;
  onDelete: () => void;
  onMove: () => void;
  onPress: () => void;
  onPublish: () => void;
  onRename: () => void;
  onUnpublish: () => void;
  onViewPublished?: () => void;
}) {
  const updatedAt = noteTimestampMs(note.updatedAt ?? note.createdAt);
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
    [
      'neutral',
      {
        title: isPublished ? 'Update published note' : 'Publish to web',
        description: isPublished ? publishedUrl ?? undefined : undefined,
        startIcon: 'EyeOpen',
        action: onPublish,
        disabled: publishDisabled,
        testID: `NotesPublishNoteAction-${note.noteId}`,
      },
      isPublished && publishedUrl && onViewPublished
        ? {
            title: 'View published note',
            startIcon: 'Link',
            action: onViewPublished,
            testID: `NotesViewPublishedNoteAction-${note.noteId}`,
          }
        : null,
    ],
    canEdit && [
      'negative',
      isPublished && {
        title: 'Unpublish note',
        startIcon: 'EyeClosed',
        action: onUnpublish,
        disabled: publishDisabled || publishingAction === 'unpublish',
        testID: `NotesUnpublishNoteAction-${note.noteId}`,
      },
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
      selected={selected}
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

function TreeRowFrame({
  children,
  onPress,
  onOpenMenu,
  onMouseEnter,
  onMouseLeave,
  selected = false,
  testID,
}: {
  children: ReactNode;
  onPress: () => void;
  onOpenMenu?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  selected?: boolean;
  testID?: string;
}) {
  return (
    <TreeRowPressable
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onOpenMenu={onOpenMenu}
      onPress={onPress}
      testID={testID}
    >
      <ListItem
        alignItems="stretch"
        position="relative"
        borderRadius="$xl"
        backgroundColor={selected ? '$shadow' : 'transparent'}
        paddingLeft="$l"
        paddingRight="$l"
        paddingVertical="$l"
        gap="$l"
      >
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
