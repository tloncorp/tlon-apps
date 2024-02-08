import * as models from './models';
import {QueryFn, Results} from './types';
import {hasValues} from '@utils/list';

export const channelQuery =
  (settings?: models.StreamQuerySettings | null): QueryFn<'Channel'> =>
  (channels: Results<'Channel'>) => {
    channels = channels.filtered('title != NULL');
    if (!settings?.includeEmpty) {
      channels = channels.filtered('latestPost != NULL');
    }
    if (settings?.containsText) {
      channels = channels.filtered(
        'title CONTAINS[c] $0',
        settings?.containsText,
      );
    }
    if (hasValues(settings?.inGroups)) {
      channels = channels.filtered(
        'group.id IN $0',
        settings.inGroups.map((g: models.Group) => g.id),
      );
    }
    if (settings?.updatedAfter) {
      channels = channels.filtered(
        'latestPost.receivedAt > $0',
        settings.updatedAfter,
      );
    }
    const sortBy = settings?.sortBy || 'latestPost';
    const resolvedSortBy =
      sortBy === 'latestPost' ? 'latestPost.receivedAt' : sortBy;
    const resolvedSortDirection = settings?.sortDirection || 'desc';
    return channels.sorted(resolvedSortBy, resolvedSortDirection === 'desc');
  };

export const groupQuery = (settings?: models.StreamQuerySettings | null) => {
  return (groups: Results<'Group'>) => {
    if (settings?.containsText) {
      groups = groups.filtered('title CONTAINS[c] $0', settings.containsText);
    }
    const sortBy = settings?.sortBy || 'latestPost';
    const resolvedSortBy =
      sortBy === 'latestPost' ? 'latestPost.receivedAt' : sortBy;
    const resolvedSortDirection = settings?.sortDirection || 'desc';
    if (sortBy === 'latestPost') {
      groups = groups.filtered('latestPost != NULL');
    }
    if (settings?.updatedAfter) {
      groups = groups.filtered(
        'latestPost.receivedAt > $0',
        settings.updatedAfter,
      );
    }
    return groups.sorted(resolvedSortBy, resolvedSortDirection === 'desc');
  };
};

export const postQuery =
  (settings?: models.StreamQuerySettings | null): QueryFn<'Post'> =>
  (posts: Results<'Post'>) => {
    // Author being null indicates that this is a deleted post.
    // TODO: Consider adding an isDeleted field to posts.
    posts = posts.filtered('author != NULL');
    if (hasValues(settings?.ofType)) {
      // Using Array.from to ensure that the array is not a Realm List, which
      // will cause an error.
      posts = posts.filtered('type IN $0', Array.from(settings.ofType));
    }
    if (hasValues(settings?.inChannels)) {
      posts = posts.filtered(
        'channel.id IN $0',
        settings.inChannels.map((c: models.Channel) => c.id),
      );
    }
    if (hasValues(settings?.inGroups)) {
      posts = posts.filtered(
        'channel.group.id IN $0',
        settings.inGroups.map((g: models.Group) => g.id),
      );
    }
    if (settings?.updatedAfter) {
      posts = posts.filtered('receivedAt > $0', settings.updatedAfter);
    }
    const sortBy = settings?.sortBy || 'receivedAt';
    const resolvedSortDirection = settings?.sortDirection || 'desc';
    return posts.sorted(sortBy, resolvedSortDirection === 'desc');
  };
