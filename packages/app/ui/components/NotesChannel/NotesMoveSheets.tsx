import * as db from '@tloncorp/shared/db';
import { Button, Pressable, Text } from '@tloncorp/ui';
import Fuse from 'fuse.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, XStack, YStack, getTokenValue } from 'tamagui';

import { ActionSheet } from '../ActionSheet';
import { TextInput } from '../Form';
import { ListItem } from '../ListItem';
import type { FolderDestinationRow, FolderRow } from './notesTree';
import { buildFolderDestinationRows } from './notesTree';

const MOVE_DESTINATION_SHEET_SNAP_POINTS = [85];

export function MoveNoteSheet({
  folderRows,
  isMoving,
  note,
  onMove,
  onOpenChange,
  open,
}: {
  folderRows: FolderRow[];
  isMoving: boolean;
  note: db.NotesNote | null;
  onMove: (folderId: number) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const hiddenFolderIds = useMemo(
    () => new Set<number>(note ? [note.folderId] : []),
    [note]
  );
  const {
    destinations,
    selectedDestination,
    selectedFolderId,
    setSelectedFolderId,
  } = useFolderDestinationSelection({
    folderRows,
    hiddenFolderIds,
    resetKey: open ? note?.id : null,
  });
  const title = note?.title?.trim() || 'Untitled';

  return (
    <MoveDestinationSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Move note"
      subtitle={`Choose a new folder for ${title}.`}
      testID="NotesMoveNoteSheet"
      isMoving={isMoving}
      selectedDestination={selectedDestination}
      onConfirm={onMove}
    >
      <FolderDestinationSearch
        destinations={destinations}
        isLoading={isMoving}
        onSelectFolder={setSelectedFolderId}
        resetKey={open ? note?.id : null}
        selectedFolderId={selectedFolderId}
        testID="NotesMoveNoteFolderPicker"
      />
    </MoveDestinationSheet>
  );
}

export function useFolderDestinationSelection({
  folderRows,
  hiddenFolderIds,
  resetKey,
}: {
  folderRows: FolderRow[];
  hiddenFolderIds?: Set<number>;
  resetKey?: string | number | null;
}) {
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const destinations = useMemo(
    () => buildFolderDestinationRows({ folderRows, hiddenFolderIds }),
    [folderRows, hiddenFolderIds]
  );
  const selectedDestination = useMemo(
    () =>
      destinations.find(
        (destination) => destination.folder.folderId === selectedFolderId
      ) ?? null,
    [destinations, selectedFolderId]
  );

  useEffect(() => {
    setSelectedFolderId(null);
  }, [resetKey]);

  useEffect(() => {
    if (selectedFolderId !== null && selectedDestination === null) {
      setSelectedFolderId(null);
    }
  }, [selectedDestination, selectedFolderId]);

  return {
    destinations,
    selectedDestination,
    selectedFolderId,
    setSelectedFolderId,
  };
}

export function MoveDestinationSheet({
  children,
  isMoving,
  onConfirm,
  onOpenChange,
  open,
  selectedDestination,
  subtitle,
  testID,
  title,
}: {
  children: ReactNode;
  isMoving: boolean;
  onConfirm: (folderId: number) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  selectedDestination: FolderDestinationRow | null;
  subtitle: string;
  testID: string;
  title: string;
}) {
  const insets = useSafeAreaInsets();
  const handleConfirm = useCallback(() => {
    if (!selectedDestination || isMoving) return;
    onConfirm(selectedDestination.folder.folderId);
  }, [isMoving, onConfirm, selectedDestination]);

  const renderFooter = useCallback(() => {
    if (!selectedDestination) {
      return null;
    }

    return (
      <YStack
        paddingBottom={insets.bottom + getTokenValue('$xl', 'size')}
        paddingHorizontal="$xl"
      >
        <Button
          preset="primary"
          onPress={handleConfirm}
          disabled={isMoving}
          label={
            isMoving
              ? 'Moving...'
              : `Move to ${selectedDestination.displayPath}`
          }
          centered
        />
      </YStack>
    );
  }, [handleConfirm, insets.bottom, isMoving, selectedDestination]);

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPointsMode="percent"
      snapPoints={MOVE_DESTINATION_SHEET_SNAP_POINTS}
      keyboardBehavior="extend"
      enableContentPanningGesture={false}
      hasScrollableContent
      footerComponent={renderFooter}
      unmountOnClose
    >
      <ActionSheet.Content flex={1} paddingBottom="$s" testID={testID}>
        <ActionSheet.SimpleHeader title={title} subtitle={subtitle} />
        {children}
      </ActionSheet.Content>
    </ActionSheet>
  );
}

export function FolderDestinationSearch({
  destinations,
  isLoading = false,
  maxHeight = 520,
  onSelectFolder,
  resetKey,
  selectedFolderId,
  testID,
}: {
  destinations: FolderDestinationRow[];
  isLoading?: boolean;
  maxHeight?: number;
  onSelectFolder: (folderId: number) => void;
  resetKey?: string | number | null;
  selectedFolderId?: number | null;
  testID?: string;
}) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    setQuery('');
  }, [resetKey]);

  const fuse = useMemo(
    () =>
      new Fuse(destinations, {
        keys: ['displayPath', 'label'],
        threshold: 0.4,
      }),
    [destinations]
  );

  const filteredDestinations = useMemo(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return destinations;
    }
    return fuse.search(trimmedQuery).map((result) => result.item);
  }, [destinations, fuse, query]);

  const handleClear = useCallback(() => {
    setQuery('');
  }, []);

  const listPadding = useMemo(() => getTokenValue('$l', 'size'), []);
  const contentContainerStyle = useMemo(
    () => ({
      padding: listPadding,
      paddingBottom: selectedFolderId ? 100 : listPadding,
    }),
    [listPadding, selectedFolderId]
  );

  return (
    <YStack testID={testID}>
      <XStack paddingHorizontal="$xl">
        <TextInput
          frameStyle={{ width: '100%' }}
          icon="Search"
          placeholder="Search folders"
          value={query}
          onChangeText={setQuery}
          spellCheck={false}
          autoCorrect={false}
          autoCapitalize="none"
          autoFocus={Platform.OS === 'web'}
          rightControls={
            query !== '' ? (
              <TextInput.InnerButton label="Clear" onPress={handleClear} />
            ) : undefined
          }
        />
      </XStack>
      <ScrollView
        maxHeight={maxHeight}
        contentContainerStyle={contentContainerStyle}
      >
        <YStack gap="$xs">
          {filteredDestinations.length > 0 ? (
            filteredDestinations.map((destination) => (
              <FolderDestinationSearchRow
                key={destination.folder.id}
                destination={destination}
                disabled={isLoading}
                selected={selectedFolderId === destination.folder.folderId}
                onPress={() => onSelectFolder(destination.folder.folderId)}
              />
            ))
          ) : (
            <YStack padding="$l" alignItems="center">
              <Text size="$label/m" color="$secondaryText">
                {query.trim()
                  ? 'No folders found'
                  : 'No destinations available'}
              </Text>
            </YStack>
          )}
        </YStack>
      </ScrollView>
    </YStack>
  );
}

function FolderDestinationSearchRow({
  destination,
  disabled,
  onPress,
  selected,
}: {
  destination: FolderDestinationRow;
  disabled: boolean;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      borderRadius="$xl"
      disabled={disabled}
      hoverStyle={{ backgroundColor: '$secondaryBackground' }}
      onPress={disabled ? undefined : onPress}
    >
      <ListItem
        alignItems="center"
        backgroundColor={
          selected
            ? '$positiveBackground'
            : destination.isRoot
              ? '$secondaryBackground'
              : 'transparent'
        }
        borderColor={selected ? '$positiveBorder' : 'transparent'}
        borderWidth="$2xs"
        justifyContent="flex-start"
        opacity={disabled ? 0.6 : 1}
      >
        <ListItem.SystemIcon
          icon={destination.isRoot ? 'Home' : 'Folder'}
          backgroundColor={destination.isRoot ? '$background' : undefined}
          color={destination.isRoot ? '$primaryText' : '$tertiaryText'}
        />
        <ListItem.MainContent>
          <ListItem.Title>{destination.displayPath}</ListItem.Title>
          {destination.isRoot ? (
            <ListItem.Subtitle>Top level</ListItem.Subtitle>
          ) : null}
        </ListItem.MainContent>
      </ListItem>
    </Pressable>
  );
}
