import {
  markNotesNotebookOpened,
  useEnsureNotesNotebookJoined,
  useNotesNotebookWithRelations,
  useSyncNotesNotebook,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { LoadingSpinner, Text } from '@tloncorp/ui';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { YStack } from 'tamagui';

const EMPTY_FOLDERS: db.NotesFolder[] = [];
const EMPTY_NOTES: db.NotesNote[] = [];

export type NotebookGate = 'unavailable' | 'loading' | 'unjoinable' | null;

export function useNotebookData(
  notebookFlag: string | null | undefined,
  options: { syncEnabled?: boolean } = {}
) {
  const joinQuery = useEnsureNotesNotebookJoined({ notebookFlag });
  const joined = joinQuery.data === true;
  const syncEnabled = options.syncEnabled ?? true;
  const syncQuery = useSyncNotesNotebook({
    notebookFlag,
    enabled:
      Boolean(notebookFlag) && joined && !joinQuery.isLoading && syncEnabled,
  });
  const notebookQuery = useNotesNotebookWithRelations(notebookFlag, joined);

  const notebook = notebookQuery.data ?? null;
  const folders = notebook?.folders ?? EMPTY_FOLDERS;
  const notes = notebook?.notes ?? EMPTY_NOTES;
  const canEdit = notebook
    ? notebook.currentUserRole === 'owner' ||
      notebook.currentUserRole === 'editor'
    : false;
  const rootFolderId =
    notebook?.rootFolderId ??
    folders.find((folder) => folder.parentFolderId === null)?.folderId ??
    folders[0]?.folderId ??
    null;

  useEffect(() => {
    if (!notebookFlag) return;
    markNotesNotebookOpened(notebookFlag);
  }, [notebookFlag]);

  // A joined notebook with no local row means the sync failed (or hasn't
  // run) before anything was cached — gate as unavailable rather than
  // rendering an empty notebook. With a cached row, stale data renders and
  // sync failures stay non-blocking.
  const gate: NotebookGate = !notebookFlag
    ? 'unavailable'
    : joinQuery.isLoading ||
        (!notebook && (syncQuery.isLoading || notebookQuery.isLoading))
      ? 'loading'
      : !joined
        ? 'unjoinable'
        : !notebook
          ? 'unavailable'
          : null;

  return { notebook, folders, notes, canEdit, rootFolderId, gate };
}

export function NotebookGateMessage({
  gate,
  loadingTitle,
  unavailableTitle,
}: {
  gate: Exclude<NotebookGate, null>;
  loadingTitle: string;
  unavailableTitle: string;
}) {
  if (gate === 'unavailable') {
    return <NotesMessage title={unavailableTitle} />;
  }
  if (gate === 'loading') {
    return (
      <NotesMessage title={loadingTitle}>
        <LoadingSpinner />
      </NotesMessage>
    );
  }
  return (
    <NotesMessage
      title="Unable to join notebook"
      subtitle="This notebook is private or no longer available."
    />
  );
}

export function NotesMessage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      gap="$m"
      padding="$2xl"
      backgroundColor="$background"
    >
      {children}
      <Text size="$label/l" color="$primaryText" textAlign="center">
        {title}
      </Text>
      {subtitle ? (
        <Text size="$label/m" color="$tertiaryText" textAlign="center">
          {subtitle}
        </Text>
      ) : null}
    </YStack>
  );
}
