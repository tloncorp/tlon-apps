import {
  createNotebookFolder,
  createNotebookNote,
  useMutableCallback,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps, DragEvent } from 'react';
import { YStack } from 'tamagui';

import {
  NOTES_PENDING_WRITE_MESSAGE,
  errorMessage,
  isNotesPendingWriteError,
} from './NotesCommon';
import {
  buildNotesImportItems,
  getNotesImportTargetFolderId,
  makeUniqueNoteTitle,
  normalizeTitleKey,
  readNotesImportSourcesFromDataTransfer,
  selectNotesImportSources,
} from './notesImport';
import type { NotesImportSource } from './notesImport';
import { trackNotesActionError } from './notesTelemetry';

export function useNotesImportController({
  activeFolderId,
  canDropImportNotes,
  canEdit,
  folders,
  notebookFlag,
  notes,
  rootFolderId,
  selectedFolderId,
  setError,
}: {
  activeFolderId: number | null;
  canDropImportNotes: boolean;
  canEdit: boolean;
  folders: db.NotesFolder[];
  notebookFlag: string | null | undefined;
  notes: db.NotesNote[];
  rootFolderId: number | null;
  selectedFolderId: number | null;
  setError: (error: string | null) => void;
}) {
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [isDragImportActive, setIsDragImportActive] = useState(false);
  const [isImportingNotes, setIsImportingNotes] = useState(false);
  const dragImportDepthRef = useRef(0);

  const importNotesFromSources = useMutableCallback(
    async (
      sources: NotesImportSource[] | null,
      targetRootFolderId: number,
      importNotebookFlag: string
    ) => {
      if (!sources) {
        return;
      }

      const importItems = buildNotesImportItems(sources);
      if (importItems.length === 0) {
        setImportNotice('No markdown or text files found.');
        return;
      }

      const foldersByParentAndName = new Map<string, db.NotesFolder>();
      folders.forEach((folder) => {
        const key = folderCacheKey(folder.name, folder.parentFolderId);
        foldersByParentAndName.set(key, folder);
      });

      const noteTitlesByFolder = new Map<number, Set<string>>();
      notes.forEach((note) => {
        const titles = noteTitlesByFolder.get(note.folderId) ?? new Set();
        titles.add(normalizeTitleKey(note.title));
        noteTitlesByFolder.set(note.folderId, titles);
      });

      const ensureFolderPath = async (segments: string[]) => {
        let parentFolderId = targetRootFolderId;
        for (const segment of segments) {
          const key = folderCacheKey(segment, parentFolderId);
          const existing = foldersByParentAndName.get(key);
          if (existing) {
            parentFolderId = existing.folderId;
            continue;
          }

          const folder = await createNotebookFolder({
            notebookFlag: importNotebookFlag,
            parentFolderId,
            name: segment,
          });
          if (!folder) {
            throw new Error(
              `${NOTES_PENDING_WRITE_MESSAGE}; the outcome is unknown and it may still complete. Check whether folder "${segment}" was created before retrying.`
            );
          }

          foldersByParentAndName.set(key, folder);
          parentFolderId = folder.folderId;
        }
        return parentFolderId;
      };

      let importedCount = 0;
      let failedCount = 0;
      for (const item of importItems) {
        try {
          const folderId = await ensureFolderPath(item.folderSegments);
          const existingTitles = noteTitlesByFolder.get(folderId) ?? new Set();
          noteTitlesByFolder.set(folderId, existingTitles);
          const title = makeUniqueNoteTitle(item.title, existingTitles);
          const note = await createNotebookNote({
            notebookFlag: importNotebookFlag,
            folderId,
            title,
            body: item.body,
          });
          if (!note) {
            throw new Error(
              `${NOTES_PENDING_WRITE_MESSAGE}; the outcome is unknown and it may still complete. Check whether note "${title}" was created before retrying.`
            );
          }
          importedCount += 1;
        } catch (e) {
          if (isNotesPendingWriteError(e)) {
            throw e;
          }
          console.error('Failed to import note', item.relativePath, e);
          failedCount += 1;
        }
      }

      if (importedCount === 0 && failedCount > 0) {
        throw new Error(
          `Failed to import ${formatCount(failedCount, 'note')}.`
        );
      }

      setImportNotice(formatImportNotice(importedCount, failedCount));
    }
  );

  const runImport = useMutableCallback(
    async (readSources: () => Promise<NotesImportSource[] | null>) => {
      const targetRootFolderId = getNotesImportTargetFolderId({
        activeFolderId,
        rootFolderId,
        selectedFolderId,
      });

      if (
        !notebookFlag ||
        targetRootFolderId == null ||
        !canEdit ||
        isImportingNotes
      ) {
        return;
      }

      setError(null);
      setImportNotice(null);
      setIsImportingNotes(true);
      try {
        await importNotesFromSources(
          await readSources(),
          targetRootFolderId,
          notebookFlag
        );
      } catch (e) {
        const message = errorMessage(e, 'Failed to import notes');
        trackNotesActionError('import notes', e, message, {
          targetRootFolderId,
        });
        setError(message);
      } finally {
        setIsImportingNotes(false);
      }
    }
  );

  const importFiles = useMutableCallback(() => {
    void runImport(() => selectNotesImportSources('files'));
  });

  const importFolder = useMutableCallback(() => {
    void runImport(() => selectNotesImportSources('folder'));
  });

  const prepareImportDragEvent = useMutableCallback((event: DragEvent) => {
    if (
      !canDropImportNotes ||
      !Array.from(event.dataTransfer.types ?? []).includes('Files')
    ) {
      return false;
    }
    event.preventDefault();
    event.stopPropagation();
    return true;
  });

  const handleImportDragEnter = useMutableCallback((event: DragEvent) => {
    if (!prepareImportDragEvent(event)) return;
    dragImportDepthRef.current += 1;
    setIsDragImportActive(true);
  });

  const handleImportDragOver = useMutableCallback((event: DragEvent) => {
    if (!prepareImportDragEvent(event)) return;
    event.dataTransfer.dropEffect = isImportingNotes ? 'none' : 'copy';
  });

  const handleImportDragLeave = useMutableCallback((event: DragEvent) => {
    if (!prepareImportDragEvent(event)) return;
    dragImportDepthRef.current = Math.max(0, dragImportDepthRef.current - 1);
    if (dragImportDepthRef.current === 0) {
      setIsDragImportActive(false);
    }
  });

  const handleImportDrop = useMutableCallback((event: DragEvent) => {
    if (!prepareImportDragEvent(event)) return;
    dragImportDepthRef.current = 0;
    setIsDragImportActive(false);
    void runImport(() =>
      readNotesImportSourcesFromDataTransfer(event.dataTransfer)
    );
  });

  const dropImportProps = useMemo(
    () =>
      canDropImportNotes
        ? ({
            onDragEnter: handleImportDragEnter,
            onDragLeave: handleImportDragLeave,
            onDragOver: handleImportDragOver,
            onDrop: handleImportDrop,
          } as unknown as ComponentProps<typeof YStack>)
        : {},
    [
      canDropImportNotes,
      handleImportDragEnter,
      handleImportDragLeave,
      handleImportDragOver,
      handleImportDrop,
    ]
  );

  useEffect(() => {
    if (!canDropImportNotes) {
      dragImportDepthRef.current = 0;
      setIsDragImportActive(false);
    }
  }, [canDropImportNotes]);

  return {
    dropImportProps,
    importFiles,
    importFolder,
    importNotice,
    isDragImportActive,
    isImportingNotes,
  };
}

function folderCacheKey(name: string, parentFolderId?: number | null) {
  return `${parentFolderId ?? 'root'}:${normalizeTitleKey(name)}`;
}

function formatImportNotice(importedCount: number, failedCount: number) {
  return failedCount === 0
    ? `Imported ${formatCount(importedCount, 'note')}.`
    : `Imported ${formatCount(importedCount, 'note')}; ${formatCount(
        failedCount,
        'note'
      )} failed.`;
}

function formatCount(count: number, label: string) {
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}
