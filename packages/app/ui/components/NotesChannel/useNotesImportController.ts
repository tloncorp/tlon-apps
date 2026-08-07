import {
  AnalyticsEvent,
  importNotebookTree,
  trackEvent,
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
} from './NotesFeedback';
import {
  buildNotesImportItems,
  getNotesImportTargetFolderId,
  normalizeTitleKey,
  planNotesImport,
  readNotesImportSourcesFromDataTransfer,
  selectNotesImportSources,
} from './notesImport';
import type { NotesImportNode, NotesImportSource } from './notesImport';
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
  // Synchronous re-entrancy guard: isImportingNotes lags a render behind, so
  // two quick drops could both pass a state-based check.
  const importRunRef = useRef(false);

  const importNotesFromSources = useMutableCallback(
    async (
      sources: NotesImportSource[],
      targetRootFolderId: number,
      importNotebookFlag: string
    ) => {
      const importItems = buildNotesImportItems(sources);
      if (importItems.length === 0) {
        setImportNotice('No markdown or text files found.');
        return;
      }

      const existingNoteTitles = new Map<number, Set<string>>();
      notes.forEach((note) => {
        const titles = existingNoteTitles.get(note.folderId) ?? new Set();
        titles.add(normalizeTitleKey(note.title));
        existingNoteTitles.set(note.folderId, titles);
      });

      const batches = planNotesImport({
        items: importItems,
        targetRootFolderId,
        existingFolders: folders,
        existingNoteTitles,
      });

      // Each batch is one poke that creates its whole subtree host-side; the
      // created folders and notes arrive as stream updates. Batches are
      // sequential so a later one can't be planned against folders an
      // earlier one is still creating.
      let importedCount = 0;
      for (const batch of batches) {
        try {
          const { noteCount } = await importNotebookTree({
            notebookFlag: importNotebookFlag,
            parentFolderId: batch.parentFolderId,
            tree: batch.tree,
          });
          importedCount += noteCount;
        } catch (e) {
          if (isNotesPendingWriteError(e)) {
            throw e;
          }
          const message = errorMessage(e, 'Failed to import notes');
          throw new Error(
            `${NOTES_PENDING_WRITE_MESSAGE}; the outcome of importing ${formatCount(
              countBatchNotes(batch.tree),
              'note'
            )} is unknown and it may still complete. Check what was imported before retrying. ${message}`
          );
        }
      }

      trackEvent(AnalyticsEvent.NotesImportCompleted, {
        noteCount: importedCount,
      });
      setImportNotice(formatImportNotice(importedCount));
    }
  );

  const runImport = useMutableCallback(
    async (
      readSources: (
        onSourcesChosen: () => void
      ) => Promise<NotesImportSource[] | null>
    ) => {
      const targetRootFolderId = getNotesImportTargetFolderId({
        activeFolderId,
        rootFolderId,
        selectedFolderId,
      });

      if (
        !notebookFlag ||
        targetRootFolderId == null ||
        !canEdit ||
        importRunRef.current
      ) {
        return;
      }

      const setImportLatch = (value: boolean) => {
        importRunRef.current = value;
        setIsImportingNotes(value);
      };

      setError(null);
      setImportNotice(null);
      try {
        // The reader latches via the callback as soon as a concrete selection
        // exists (files dropped, or a picker committed) so a second action
        // can't start a concurrent import while contents are being read. The
        // latch can't simply be set up front: an empty webkitdirectory pick
        // fires neither `change` nor `cancel`, so an unlatched pending picker
        // has to stay harmless.
        const sources = await readSources(() => setImportLatch(true));
        if (!sources) {
          return;
        }
        setImportLatch(true);
        await importNotesFromSources(sources, targetRootFolderId, notebookFlag);
      } catch (e) {
        const message = errorMessage(e, 'Failed to import notes');
        trackNotesActionError('import notes', e, message, {
          targetRootFolderId,
        });
        setError(message);
      } finally {
        setImportLatch(false);
      }
    }
  );

  const importFiles = useMutableCallback(() => {
    void runImport((onSourcesChosen) =>
      selectNotesImportSources('files', { onFilesChosen: onSourcesChosen })
    );
  });

  const importFolder = useMutableCallback(() => {
    void runImport((onSourcesChosen) =>
      selectNotesImportSources('folder', { onFilesChosen: onSourcesChosen })
    );
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
    void runImport((onSourcesChosen) => {
      onSourcesChosen();
      return readNotesImportSourcesFromDataTransfer(event.dataTransfer);
    });
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

function countBatchNotes(tree: NotesImportNode[]): number {
  return tree.reduce(
    (total, node) =>
      total + ('children' in node ? countBatchNotes(node.children) : 1),
    0
  );
}

function formatImportNotice(importedCount: number) {
  return `Imported ${formatCount(importedCount, 'note')}.`;
}

function formatCount(count: number, label: string) {
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}
