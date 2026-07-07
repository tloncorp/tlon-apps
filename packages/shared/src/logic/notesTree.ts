type FolderNode = {
  folderId: number;
  parentFolderId?: number | null;
};

export function collectDescendantFolderIds(
  folders: FolderNode[],
  folderId: number
) {
  const ids = new Set([folderId]);
  let added = true;
  while (added) {
    added = false;
    folders.forEach((folder) => {
      if (
        folder.parentFolderId != null &&
        ids.has(folder.parentFolderId) &&
        !ids.has(folder.folderId)
      ) {
        ids.add(folder.folderId);
        added = true;
      }
    });
  }
  return ids;
}
