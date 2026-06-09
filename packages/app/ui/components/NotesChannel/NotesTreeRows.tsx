import * as db from '@tloncorp/shared/db';
import { Icon, Pressable, Text } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { TamaguiWebElement, XStack, YStack, styled } from 'tamagui';

import type { Action } from '../ActionSheet';
import { ActionSheet } from '../ActionSheet';
import { ListItem } from '../ListItem';
import { OverflowTriggerButton } from '../OverflowMenuButton';
import { formatNoteDate } from './notesTree';
import type { NotesTreeViewStyle } from './notesTree';

const TREE_ROW_HEIGHT = 44;
const TREE_LEVEL_WIDTH = 20;
const TREE_ROW_LEFT_PADDING = 2;
const TREE_ROW_GAP = 6;
const TREE_GUIDE_LEFT = TREE_ROW_LEFT_PADDING + TREE_ROW_GAP;
const TREE_CARET_CENTER_Y = TREE_ROW_HEIGHT / 2;
const TREE_CHILD_GUIDE_CARET_OFFSET = 8;
const TREE_CHILD_GUIDE_TOP =
  TREE_CARET_CENTER_Y + TREE_CHILD_GUIDE_CARET_OFFSET;

// Row frame for the comfortable ('notes') view; the outline view uses
// TreeRowFrame below. Pass minHeight and depth-based paddingLeft inline.
const NotesViewRow = styled(XStack, {
  alignItems: 'center',
  gap: '$m',
  paddingVertical: '$s',
  paddingRight: '$m',
  backgroundColor: '$background',
  borderBottomColor: '$border',
  borderBottomWidth: 1,
  variants: {
    selected: {
      true: {
        backgroundColor: '$secondaryBackground',
      },
    },
  } as const,
});

export function FolderTreeRow({
  depth,
  expanded,
  hasChildren,
  label,
  noteCount,
  selected,
  viewStyle,
  onOpenMenu,
  onPress,
}: {
  depth: number;
  expanded: boolean;
  hasChildren: boolean;
  label: string;
  noteCount: number;
  selected: boolean;
  viewStyle: NotesTreeViewStyle;
  onOpenMenu?: () => void;
  onPress: () => void;
}) {
  if (viewStyle === 'notes') {
    return (
      <TreeRowPressable
        onOpenMenu={onOpenMenu}
        onPress={onPress}
        testID={`NotesFolderRow-${label}`}
      >
        <NotesViewRow
          minHeight={56}
          paddingLeft={8 + depth * 20}
          selected={selected}
        >
          <Icon
            type="Folder"
            size="$m"
            color={selected ? '$primaryText' : '$systemNoticeText'}
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
          {noteCount > 0 ? (
            <Text size="$label/m" color="$tertiaryText" letterSpacing={0}>
              {noteCount}
            </Text>
          ) : null}
          <TreeChevron expanded={expanded} hasChildren={hasChildren} />
        </NotesViewRow>
      </TreeRowPressable>
    );
  }

  return (
    <TreeRowFrame
      depth={depth}
      showChildGuide={expanded && hasChildren}
      selected={selected}
      onOpenMenu={onOpenMenu}
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
      {noteCount > 0 ? (
        <ListItem.EndContent paddingTop={0}>
          <ListItem.Subtitle
            size="$label/s"
            color="$tertiaryText"
            letterSpacing={0}
          >
            {noteCount}
          </ListItem.Subtitle>
        </ListItem.EndContent>
      ) : null}
    </TreeRowFrame>
  );
}

export function NoteRow({
  canEdit,
  depth,
  note,
  viewStyle,
  onMove,
  onPress,
}: {
  canEdit: boolean;
  depth: number;
  note: db.NotesNote;
  viewStyle: NotesTreeViewStyle;
  onMove: () => void;
  onPress: () => void;
}) {
  const updatedAt = formatNoteDate(note.updatedAt);
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

  const actions = useMemo<Action[]>(
    () => [
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
    [canEdit, note.noteId, onMove, onPress]
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
        setActionsOpen(true);
      }}
    />
  ) : null;
  const actionsMenu =
    canEdit && (actionsOpen || actionsTrigger) ? (
      <ActionSheet
        open={actionsOpen}
        onOpenChange={setActionsOpen}
        mode={Platform.OS === 'web' ? 'popover' : 'sheet'}
        trigger={actionsTrigger}
        modal
        snapPointsMode="fit"
      >
        <ActionSheet.Content>
          <ActionSheet.ActionGroup accent="neutral">
            {actions.map((action) => (
              <ActionSheet.Action
                key={action.title}
                action={action}
                testID={action.testID}
              />
            ))}
          </ActionSheet.ActionGroup>
        </ActionSheet.Content>
      </ActionSheet>
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
        <NotesViewRow minHeight={58} paddingLeft={8 + depth * 20}>
          <Icon type="ChannelNote" size="$m" color="$tertiaryText" />
          <YStack flex={1} minWidth={0} gap={2}>
            <Text
              size="$label/l"
              color="$primaryText"
              numberOfLines={1}
              letterSpacing={0}
            >
              {note.title || 'Untitled'}
            </Text>
            {updatedAt ? (
              <Text size="$label/s" color="$tertiaryText" letterSpacing={0}>
                {updatedAt}
              </Text>
            ) : null}
          </YStack>
          {actionsMenu}
          <Icon type="ChevronRight" size="$s" color="$tertiaryText" />
        </NotesViewRow>
      </TreeRowPressable>
    );
  }

  return (
    <TreeRowFrame
      depth={depth}
      onMouseEnter={handleHoverIn}
      onMouseLeave={handleHoverOut}
      onOpenMenu={canEdit ? openActions : undefined}
      onPress={onPress}
      testID={`NotesNoteRow-${note.noteId}`}
    >
      <XStack width={20} />
      <ListItem.SystemIcon
        icon="ChannelNote"
        size="$2xl"
        color="$tertiaryText"
        backgroundColor="transparent"
      />
      <ListItem.MainContent height="auto" minHeight={0}>
        <ListItem.Title size="$label/m" color="$primaryText" letterSpacing={0}>
          {note.title || 'Untitled'}
        </ListItem.Title>
      </ListItem.MainContent>
      {updatedAt || actionsTrigger ? (
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

function TreeChevron({
  expanded,
  hasChildren,
}: {
  expanded: boolean;
  hasChildren: boolean;
}) {
  return (
    <XStack width={20} height={20} alignItems="center" justifyContent="center">
      {hasChildren ? (
        <Icon
          type={expanded ? 'ChevronDown' : 'ChevronRight'}
          size="$s"
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
