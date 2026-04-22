export const PersonalGroupSlugs = {
  slug: 'tm-wayfinding-group',
  chatSlug: 'tm-wayfinding-group-chat',
  collectionSlug: 'tm-wayfinding-group-collection',
  notebookSlug: 'tm-wayfinding-group-notebook',
};

export const BotHomeGroupSlugs = {
  slug: 'home-group',
  chatSlug: 'home-group-chat',
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
  tappedHomeAdd: boolean;
  tappedAddNote: boolean;
  tappedAddCollection: boolean;
  tappedChatInput: boolean;
}
