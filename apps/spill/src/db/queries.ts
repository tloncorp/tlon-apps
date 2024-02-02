import {DependencyList, useMemo} from 'react';
import {useQuery} from './hooks';
import * as models from './models';
import {QueryFn, Results} from './types';

export const channelQuery =
  (
    settings?:
      | (models.StreamQuerySettings & {
          sortBy?: 'title' | 'latestPost';
          includeEmpty?: boolean;
          updatedAfter?: number | null;
        })
      | null,
  ): QueryFn<'Channel'> =>
  (channels: Results<'Channel'>) => {
    console.log('in groups', settings?.inGroups);
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
      sortBy !== 'latestPost' ? sortBy : 'latestPost.receivedAt';
    const resolvedSortDirection = settings?.sortDirection || 'desc';
    return channels.sorted(resolvedSortBy, resolvedSortDirection === 'desc');
  };

export const groupQuery =
  (settings?: {
    titleContainsText?: string | null;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
    updatedAfter: number | null;
  }) =>
  (groups: Results<'Group'>) => {
    if (settings?.titleContainsText) {
      groups = groups.filtered(
        'title CONTAINS[c] $0',
        settings.titleContainsText,
      );
    }
    const sortBy = settings?.sortBy || 'latestPost';
    const resolvedSortBy =
      sortBy !== 'latestPost' ? sortBy : 'latestPost.receivedAt';
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

export const postQuery =
  (settings: models.StreamQuerySettings | null | undefined): QueryFn<'Post'> =>
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
    if (settings?.receivedAfter) {
      posts = posts.filtered('receivedAt > $0', settings.receivedAfter);
    }
    if (settings?.receivedBefore) {
      posts = posts.filtered('receivedAt < $0', settings.receivedBefore);
    }
    const sortBy = settings?.sortBy || 'receivedAt';
    const resolvedSortDirection = settings?.sortDirection || 'desc';
    return posts.sorted(sortBy, resolvedSortDirection === 'desc');
  };

export function useStreamQuery(
  settings: models.StreamQuerySettings | null | undefined,
  deps: DependencyList,
) {
  const query = useMemo(() => postQuery(settings), [settings]);
  return useQuery('Post', query, deps);
}

function hasValues<T extends {length: number}>(
  list: T | null | undefined,
): list is T {
  return !!(list && list.length > 0);
}
