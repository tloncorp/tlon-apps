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
import { YStack, isWeb } from 'tamagui';

const EMPTY_FOLDERS: db.NotesFolder[] = [];
const EMPTY_NOTES: db.NotesNote[] = [];

export type NotebookGate =
  | 'unavailable'
  | 'loading'
  | 'unjoinable'
  | 'notMember'
  | null;

// Neither gate has a notebook the user can act on.
export function notebookGateBlocksAccess(gate: NotebookGate) {
  return gate === 'unjoinable' || gate === 'notMember';
}

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
  const notebookQuery = useNotesNotebookWithRelations(notebookFlag);

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

  // Cached rows render while membership and sync are pending or fail, but
  // a confirmed loss of access must still hide them.
  const gate: NotebookGate = !notebookFlag
    ? 'unavailable'
    : joinQuery.data === 'notMember'
      ? 'notMember'
      : joinQuery.data === false
        ? 'unjoinable'
        : !notebook &&
            (joinQuery.isLoading ||
              syncQuery.isLoading ||
              notebookQuery.isLoading)
          ? 'loading'
          : !notebook
            ? joined
              ? 'unavailable'
              : 'unjoinable'
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
    // Mobile names what is loading in the channel header.
    if (!isWeb) {
      return (
        <YStack
          flex={1}
          alignItems="center"
          justifyContent="center"
          backgroundColor="$background"
        >
          <LoadingSpinner size="small" />
        </YStack>
      );
    }
    return (
      <NotesMessage title={loadingTitle}>
        <LoadingSpinner />
      </NotesMessage>
    );
  }
  if (gate === 'notMember') {
    return (
      <NotesMessage
        title="You're not in this notebook"
        subtitle="Join it from the group's channel list."
      />
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
