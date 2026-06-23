import * as db from '@tloncorp/shared/db';
import { Icon, Pressable, Text } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { TamaguiWebElement, XStack, YStack, styled } from 'tamagui';

import type { ActionGroup } from '../ActionSheet';
import { ActionSheet, createActionGroups } from '../ActionSheet';
import { ListItem } from '../ListItem';
import { OverflowTriggerButton } from '../OverflowMenuButton';
import { formatNoteDate, getNoteBodyPreview } from './notesTree';
import type { NotesTreeViewStyle } from './notesTree';

const TREE_ROW_HEIGHT = 44;
const TREE_LEVEL_WIDTH = 24;
const TREE_ROW_LEFT_PADDING = 2;
const TREE_ROW_GAP = 6;
const TREE_GUIDE_LEFT = TREE_ROW_LEFT_PADDING + TREE_ROW_GAP;
const TREE_CHILD_GUIDE_CARET_OFFSET = 8;
const TREE_CHILD_GUIDE_TOP =
  TREE_ROW_HEIGHT / 2 + TREE_CHILD_GUIDE_CARET_OFFSET;
const NOTES_VIEW_LEFT_PADDING = 12;

// Row frame for the comfortable ('notes') view; the outline view uses
// TreeRowFrame below.
const NotesViewRow = styled(XStack, {
  alignItems: 'center',
  gap: '$s',
  paddingVertical: 0,
  paddingRight: '$s',
  backgroundColor: '$background',
  borderBottomColor: '$border',
  borderBottomWidth: 1,
  variants: {
    selected: {
      true: {
        backgroundColor: '$secondaryBackground',
      },
    },
    depth: (depth: number) => ({
      paddingLeft: NOTES_VIEW_LEFT_PADDING + depth * TREE_LEVEL_WIDTH,
    }),
  } as const,
});

export function FolderTreeRow({
  canEdit,
  depth,
  expanded,
  folder,
  hasChildren,
  isDeleting,
  label,
  noteCount,
  selected,
  viewStyle,
  onDelete,
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
  viewStyle: NotesTreeViewStyle;
  onDelete: (folder: db.NotesFolder) => void;
  onMove: (folder: db.NotesFolder) => void;
  onPress: () => void;
  onRename: (folder: db.NotesFolder) => void;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const openActions = useCallback(() => {
    if (canEdit) {
      setActionsOpen(true);
    }
  }, [canEdit]);

  const handleHoverIn = useCallback(() => {
    if (Platform.OS === 'web') {
      setIsHovered(true);
    }
  }, []);

  const handleHoverOut = useCallback(() => {
    if (Platform.OS === 'web') {
      setIsHovered(false);
    }
  }, []);

  const actionGroups = useMemo(
    () =>
      createActionGroups(
        [
          'neutral',
          {
            title: 'Rename folder',
            startIcon: 'EditList',
            action: () => {
              setActionsOpen(false);
              onRename(folder);
            },
            testID: 'NotesRenameFolderAction',
          },
          {
            title: 'Move folder',
            startIcon: 'Folder',
            action: () => {
              setActionsOpen(false);
              onMove(folder);
            },
            testID: 'NotesMoveFolderAction',
          },
        ],
        [
          'negative',
          {
            title: 'Delete folder',
            startIcon: 'Close',
            action: () => {
              setActionsOpen(false);
              onDelete(folder);
            },
            disabled: isDeleting,
            testID: 'NotesDeleteFolderAction',
          },
        ]
      ),
    [folder, isDeleting, onDelete, onMove, onRename]
  );

  const shouldShowActionsTrigger =
    canEdit && Platform.OS === 'web' && (actionsOpen || isHovered);
  const actionsTrigger = shouldShowActionsTrigger ? (
    <OverflowTriggerButton
      paddingHorizontal="$xs"
      paddingVertical="$xs"
      marginRight="$-xs"
      onPress={(event) => {
        event.stopPropagation();
        setActionsOpen((open) => !open);
      }}
    />
  ) : null;
  const actionsMenu =
    canEdit && (actionsOpen || actionsTrigger) ? (
      <RowActionsMenu
        actionGroups={actionGroups}
        open={actionsOpen}
        onOpenChange={setActionsOpen}
        trigger={actionsTrigger}
      />
    ) : null;

  if (viewStyle === 'notes') {
    return (
      <TreeRowPressable
        onMouseEnter={handleHoverIn}
        onMouseLeave={handleHoverOut}
        onOpenMenu={canEdit ? openActions : undefined}
        onPress={onPress}
        testID={`NotesFolderRow-${label}`}
      >
        <NotesViewRow minHeight="$5xl" depth={depth} selected={selected}>
          <TreeChevron expanded={expanded} hasChildren={hasChildren} />
          <Icon
            type="Folder"
            size="$m"
            color={selected ? '$primaryText' : '$tertiaryText'}
          />
          <Text
            flex={1}
            minWidth={0}
            size="$label/l"
            color={selected ? '$primaryText' : '$secondaryText'}
            fontWeight={selected ? '600' : '400'}
            numberOfLines={1}
            letterSpacing={0}
          >
            {label}
          </Text>
          {actionsMenu}
          {noteCount > 0 ? (
            <CountFrame count={noteCount} size="$label/m" />
          ) : null}
        </NotesViewRow>
      </TreeRowPressable>
    );
  }

  return (
    <TreeRowFrame
      depth={depth}
      showChildGuide={expanded && hasChildren}
      selected={selected}
      onMouseEnter={handleHoverIn}
      onMouseLeave={handleHoverOut}
      onOpenMenu={canEdit ? openActions : undefined}
      onPress={onPress}
      testID={`NotesFolderRow-${label}`}
    >
      <TreeChevron expanded={expanded} hasChildren={hasChildren} />
      <ListItem.SystemIcon
        icon="Folder"
        size="$2xl"
        color={selected ? '$primaryText' : '$tertiaryText'}
        backgroundColor="transparent"
      />
      <ListItem.MainContent height="auto" minHeight={0}>
        <ListItem.Title
          size="$label/m"
          color={selected ? '$primaryText' : '$secondaryText'}
          fontWeight={selected ? '600' : '400'}
          letterSpacing={0}
        >
          {label}
        </ListItem.Title>
      </ListItem.MainContent>
      {noteCount > 0 || actionsMenu ? (
        <ListItem.EndContent paddingTop={0}>
          <XStack alignItems="center" gap="$xs">
            {actionsMenu}
            {noteCount > 0 ? (
              <CountFrame count={noteCount} size="$label/s" />
            ) : null}
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
  viewStyle,
  onDelete,
  onMove,
  onPress,
}: {
  canEdit: boolean;
  depth: number;
  note: db.NotesNote;
  selected?: boolean;
  viewStyle: NotesTreeViewStyle;
  onDelete: () => void;
  onMove: () => void;
  onPress: () => void;
}) {
  const updatedAt = formatNoteDate(note.updatedAt);
  const bodyPreview = useMemo(
    () => getNoteBodyPreview(note.bodyMd),
    [note.bodyMd]
  );
  const [actionsOpen, setActionsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const openActions = useCallback(() => {
    if (canEdit) {
      setActionsOpen(true);
    }
  }, [canEdit]);

  const handleHoverIn = useCallback(() => {
    if (Platform.OS === 'web') {
      setIsHovered(true);
    }
  }, []);

  const handleHoverOut = useCallback(() => {
    if (Platform.OS === 'web') {
      setIsHovered(false);
    }
  }, []);

  const actionGroups = useMemo(
    () =>
      createActionGroups(
        [
          'neutral',
          {
            title: 'Open note',
            startIcon: 'ChannelNote',
            action: () => {
              setActionsOpen(false);
              onPress();
            },
            testID: `NotesOpenNoteAction-${note.noteId}`,
          },
          {
            title: 'Move to folder',
            startIcon: 'Folder',
            action: () => {
              setActionsOpen(false);
              onMove();
            },
            disabled: !canEdit,
            testID: `NotesMoveNoteAction-${note.noteId}`,
          },
        ],
        canEdit && [
          'negative',
          {
            title: 'Delete note',
            startIcon: 'Close',
            action: () => {
              setActionsOpen(false);
              onDelete();
            },
            testID: `NotesDeleteNoteAction-${note.noteId}`,
          },
        ]
      ),
    [canEdit, note.noteId, onDelete, onMove, onPress]
  );

  const shouldShowActionsTrigger =
    canEdit && Platform.OS === 'web' && (actionsOpen || isHovered);
  const actionsTrigger = shouldShowActionsTrigger ? (
    <OverflowTriggerButton
      paddingHorizontal="$xs"
      paddingVertical="$xs"
      marginRight="$-xs"
      onPress={(event) => {
        event.stopPropagation();
        setActionsOpen((open) => !open);
      }}
    />
  ) : null;
  const actionsMenu =
    canEdit && (actionsOpen || actionsTrigger) ? (
      <RowActionsMenu
        actionGroups={actionGroups}
        open={actionsOpen}
        onOpenChange={setActionsOpen}
        trigger={actionsTrigger}
      />
    ) : null;

  if (viewStyle === 'notes') {
    return (
      <TreeRowPressable
        onMouseEnter={handleHoverIn}
        onMouseLeave={handleHoverOut}
        onOpenMenu={canEdit ? openActions : undefined}
        onPress={onPress}
        testID={`NotesNoteRow-${note.noteId}`}
      >
        <NotesViewRow minHeight="$5xl" depth={depth} selected={selected}>
          <TreeLeadingSpacer />
          <Icon
            type="ChannelNote"
            size="$m"
            color={selected ? '$primaryText' : '$tertiaryText'}
          />
          <YStack flex={1} minWidth={0} gap="$s">
            <Text
              size="$label/l"
              color={selected ? '$primaryText' : '$secondaryText'}
              fontWeight="400"
              numberOfLines={1}
              letterSpacing={0}
            >
              {note.title || 'Untitled'}
            </Text>
            {bodyPreview ? (
              <Text
                size="$label/s"
                color="$tertiaryText"
                numberOfLines={1}
                letterSpacing={0}
              >
                {bodyPreview}
              </Text>
            ) : null}
          </YStack>
          {actionsMenu}
          <Icon type="ChevronRight" size="$m" color="$tertiaryText" />
        </NotesViewRow>
      </TreeRowPressable>
    );
  }

  return (
    <TreeRowFrame
      depth={depth}
      selected={selected}
      onMouseEnter={handleHoverIn}
      onMouseLeave={handleHoverOut}
      onOpenMenu={canEdit ? openActions : undefined}
      onPress={onPress}
      testID={`NotesNoteRow-${note.noteId}`}
    >
      <TreeLeadingSpacer />
      <ListItem.SystemIcon
        icon="ChannelNote"
        size="$2xl"
        color={selected ? '$primaryText' : '$tertiaryText'}
        backgroundColor="transparent"
      />
      <ListItem.MainContent height="auto" minHeight={0}>
        <ListItem.Title
          size="$label/m"
          color={selected ? '$primaryText' : '$secondaryText'}
          fontWeight="400"
          letterSpacing={0}
        >
          {note.title || 'Untitled'}
        </ListItem.Title>
      </ListItem.MainContent>
      {updatedAt || actionsMenu ? (
        <ListItem.EndContent paddingTop={0}>
          <XStack alignItems="center" gap="$xs">
            {updatedAt ? (
              <ListItem.Subtitle
                size="$label/s"
                color="$tertiaryText"
                letterSpacing={0}
              >
                {updatedAt}
              </ListItem.Subtitle>
            ) : null}
            {actionsMenu}
          </XStack>
        </ListItem.EndContent>
      ) : null}
    </TreeRowFrame>
  );
}

function RowActionsMenu({
  actionGroups,
  open,
  onOpenChange,
  trigger,
}: {
  actionGroups: ActionGroup[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
}) {
  const isWeb = Platform.OS === 'web';

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      mode={isWeb ? 'popover' : 'sheet'}
      trigger={trigger}
      modal
      snapPointsMode="fit"
    >
      <ActionSheet.Content>
        <ActionSheet.SimpleActionGroupList actionGroups={actionGroups} />
      </ActionSheet.Content>
    </ActionSheet>
  );
}

function CountFrame({
  count,
  size,
}: {
  count: number;
  size: '$label/m' | '$label/s';
}) {
  return (
    <XStack width="$2xl" alignItems="center" justifyContent="center">
      <Text size={size} color="$tertiaryText" letterSpacing={0}>
        {count}
      </Text>
    </XStack>
  );
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

function TreeLeadingSpacer() {
  return <XStack width="$2xl" height="$2xl" flexShrink={0} />;
}

function TreeRowFrame({
  children,
  depth,
  onPress,
  onOpenMenu,
  onMouseEnter,
  onMouseLeave,
  selected = false,
  showChildGuide = false,
  testID,
}: {
  children: ReactNode;
  depth: number;
  onPress: () => void;
  onOpenMenu?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  selected?: boolean;
  showChildGuide?: boolean;
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
        alignItems="center"
        minHeight={TREE_ROW_HEIGHT}
        position="relative"
        borderRadius="$m"
        backgroundColor={selected ? '$secondaryBackground' : 'transparent'}
        paddingLeft={TREE_ROW_LEFT_PADDING}
        paddingRight="$s"
        paddingVertical="$xs"
        gap="$s"
      >
        <TreeIndentGuides depth={depth} showChildGuide={showChildGuide} />
        <XStack width={depth * TREE_LEVEL_WIDTH} flexShrink={0} />
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

function TreeIndentGuides({
  depth,
  showChildGuide = false,
}: {
  depth: number;
  showChildGuide?: boolean;
}) {
  if (depth <= 0 && !showChildGuide) return null;

  const guideCount = depth + (showChildGuide ? 1 : 0);

  return (
    <XStack
      position="absolute"
      top={-1}
      bottom={-1}
      left={TREE_GUIDE_LEFT}
      width={guideCount * TREE_LEVEL_WIDTH}
      pointerEvents="none"
    >
      {Array.from({ length: guideCount }).map((_, index) => {
        const isChildGuide = showChildGuide && index === guideCount - 1;
        return (
          <YStack
            key={index}
            position="relative"
            width={TREE_LEVEL_WIDTH}
            alignSelf="stretch"
          >
            <YStack
              position="absolute"
              top={isChildGuide ? TREE_CHILD_GUIDE_TOP : 0}
              bottom={0}
              left={TREE_LEVEL_WIDTH / 2}
              width={1}
              backgroundColor="$border"
            />
          </YStack>
        );
      })}
    </XStack>
  );
}
