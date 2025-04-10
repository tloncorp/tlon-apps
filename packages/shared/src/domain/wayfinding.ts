export const PersonalGroupSlugs = {
  slug: 'personal-group-placeholder',
  chatSlug: 'personal-group-placeholder-chat',
  collectionSlug: 'personal-group-placeholder-collection',
  notebookSlug: 'personal-group-placeholder-notebook',
};

export const PersonalGroupNames = {
  groupTitle: 'Your Home',
  groupIconUrl:
    'https://d2w9rnfcy7mm78.cloudfront.net/6750548/original_ccd5538227dc610628554c9e3d118271.jpg?1586214554?bc=0',
  chatTitle: 'Passing Thoughts',
  collectionTitle: 'Scrapbook',
  notebookTitle: 'Diary',
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
