export const PersonalGroupSlugs = {
  slug: 'personal-group-placeholder',
  chatSlug: 'personal-group-placeholder-chat',
  collectionSlug: 'personal-group-placeholder-collection',
  notebookSlug: 'personal-group-placeholder-notebook',
};

export const PersonalGroupNames = {
  groupTitle: 'Your Group',
  chatTitle: 'Chat',
  collectionTitle: 'Pictures',
  notebookTitle: 'Notes',
};

export interface WayfindingProgress {
  viewedPersonalGroup: boolean;
  viewedChatChannel: boolean;
  viewedCollectionChannel: boolean;
  viewedNotebookChannel: boolean;
  tappedAddNote: boolean;
  tappedAddCollection: boolean;
  tappedChatInput: boolean;
}
