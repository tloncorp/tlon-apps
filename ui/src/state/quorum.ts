import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router';
import {
  QueryKey,
  MutationFunction,
  useQuery,
  useQueryClient,
  UseQueryOptions,
  useMutation,
  UseMutationOptions,
} from '@tanstack/react-query';
import { Poke } from '@urbit/http-api';
import api from '@/api';
import useSchedulerStore from '@/state/scheduler';
import useReactQuerySubscription from '@/logic/useReactQuerySubscription';
import useQuorumQuerySubscription from '@/logic/useQuorumQuerySubscription';
import { getFlagParts } from '@/logic/utils';
import { decodeQuery } from '@/logic/quorum-utils';
import {
  BoardMeta,
  BoardThread,
  BoardPage,
  QuorumBrief,
  QuorumBriefs,
  ChannelUpdate,
  ChannelCreate,
  ChannelJoin,
  ChannelLeave,
  QuorumAction,
  QuorumUpdate,
  QuorumNewBoard,
  QuorumDeleteBoard,
  QuorumEditBoard,
  QuorumNewThread,
  QuorumEditThread,
  QuorumNewReply,
  QuorumEditPost,
  QuorumDeletePost,
  QuorumVote,
  QuorumDeltaSects,
  RemarkUpdate,
} from '@/types/quorum';


function quorumAction(flag: string, update: QuorumUpdate): Poke<QuorumAction> {
  return {
    app: "quorum",
    mark: "quorum-action",
    json: {
      board: flag,
      update: update,
    },
  };
}

function channelAction<Mark extends string, ChannelUpdate>(
  mark: Mark,
  update: ChannelUpdate,
): Poke<ChannelUpdate> {
  return {
    app: "quorum",
    mark: mark,
    json: update,
  };
}

// FIXME: This would be preferable to re-implementing 'useReactQuerySubscription',
// but we need the custom validation keys to support multiple keys listening
// to the same subscription path, so we need to roll our own for now.
//
// function useQuorumQuerySubscription({
//   queryKey,
//   path,
//   scry,
//   app = "quorum",
//   scryApp = app,
//   priority = 3,
//   options,
// } : {
//   queryKey: QueryKey;
//   path: string;
//   scry: string;
//   app?: string;
//   scryApp?: string;
//   priority?: number;
//   options?: UseQueryOptions;
// }): ReturnType<typeof useQuery> {
//   return useReactQuerySubscription({
//     queryKey, path, scry, app, scryApp, priority,
//     options: {
//       retryOnMount: true,
//       refetchOnMount: true,
//       ...options,
//     },
//   });
// }


export function useBoardMetas(): BoardMeta[] | undefined {
  const queryKey: QueryKey = useMemo(() => [
    "quorum", "metas"
  ], []);

  const { data, ...rest } = useQuorumQuerySubscription({
    queryKey: queryKey,
    path: `/meta/ui`,
    scry: `/boards`,
  });

  if (rest.isLoading || rest.isError) {
    return undefined;
  }

  return data as BoardMeta[];
}

export function useBoardMeta(flag: string): BoardMeta | undefined {
  const queryKey: QueryKey = useMemo(() => [
    "quorum", flag, "meta"
  ], [flag]);
  const isGlobalQuery: boolean = useMemo(() => (flag === ""), [flag]);

  const { data, ...rest } = useQuorumQuerySubscription({
    queryKey: queryKey,
    path: isGlobalQuery ? "" : `/quorum/${flag}/meta/ui`,
    scry: isGlobalQuery ? "" : `/quorum/${flag}/metadata`,
  });

  if (rest.isLoading || rest.isError) {
    return undefined;
  }

  return data as BoardMeta;
}

export function useQuorumBriefs(): QuorumBriefs {
  const { data, ...rest } = useQuorumQuerySubscription({
    queryKey: ["quorum", "briefs"],
    path: "/briefs",
    scry: "/briefs",
  });

  if (rest.isLoading || rest.isError || data === undefined) {
    return ({} as QuorumBriefs);
  }

  return (data as QuorumBriefs);
}

export function useQuorumBrief(flag: string): QuorumBrief {
  const briefs = useQuorumBriefs();
  return briefs[flag];
}

export function usePage(flag: string, index: number, query?: string): BoardPage | undefined {
  const validKey: QueryKey = useMemo(() => [
    "quorum", flag, "page"
  ], [flag]);
  const queryKey: QueryKey = useMemo(() => [
    "quorum", flag, "page", index,
    decodeQuery(query || "")
      .trim().replace(/\s+/g, " ")
      .split(" ").sort().join(" ")
      .toLowerCase() // TODO: Track this with the BE search implementation
  ], [flag, index, query]);
  const isGlobalQuery: boolean = useMemo(() => (flag === ""), [flag]);

  const { data, ...rest } = useQuorumQuerySubscription({
    queryKey: queryKey,
    validKey: validKey,
    path: isGlobalQuery
      ? `/search/ui`
      : `/quorum/${flag}/search/ui`,
    scry: isGlobalQuery
      ? `/search/${index}/${query}`
      : `/quorum/${flag}/${!query
        ? `questions/${index}`
        : `search/${index}/${query}`
      }`,
  });

  if (rest.isLoading || rest.isError) {
    return undefined;
  }

  return data as BoardPage;
}

export function useThread(flag: string, thread: number): BoardThread | undefined {
  const queryKey: QueryKey = useMemo(() => [
    "quorum", flag, "thread", thread
  ], [flag, thread]);

  const { data, ...rest } = useQuorumQuerySubscription({
    queryKey: queryKey,
    path: `/quorum/${flag}/thread/${thread}/ui`,
    scry: `/quorum/${flag}/thread/${thread}`,
  });

  if (rest.isLoading || rest.isError) {
    return undefined;
  }

  return data as BoardThread;
}

export function useRouteBoard() {
  const { chShip, chName } = useParams();
  return useMemo(() => {
    if (!chShip || !chName) {
      return '';
    }

    return `${chShip}/${chName}`;
  }, [chShip, chName]);
}

export function useBoardFlag() {
  return useRouteBoard();
}

export function useBoardMutation<TResponse>(
  mutationFn: MutationFunction<TResponse, any>,
  options?: UseMutationOptions<TResponse, unknown, any, unknown>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(["quorum", variables.flag]);

      const oldData = await queryClient.getQueryData(["quorum", variables.flag]);
      const oldBoard = oldData as BoardMeta;

      // NOTE: The following code performs local updates on the query cache
      // when mutations occur so that they are reflected to the user instantly.

      const { metadata } = variables;

      if (metadata) {
        queryClient.setQueryData(["quorum", variables.flag], {
          ...oldBoard,
          ...metadata
        });
      }

      return oldData;
    },
    onError: (err, variables, oldData) => {
      queryClient.setQueryData(["quorum", variables.flag], oldData);
    },
    onSettled: (_data, _error, variables) =>
      queryClient.invalidateQueries(["quorum", variables.flag]),
    ...options,
  });
}

export function useNewBoardMutation(options: UseMutationOptions = {}) {
  const mutationFn = (variables: {create: ChannelCreate;}) =>
    api.poke(channelAction("quorum-create", variables.create));
  return useBoardMutation(mutationFn, options);
}

export function useJoinBoardMutation(options: UseMutationOptions = {}) {
  const mutationFn = (variables: {join: ChannelJoin;}) =>
    api.poke(channelAction("channel-join", variables.join));
  return useBoardMutation(mutationFn, options);
}

export function useLeaveBoardMutation(options: UseMutationOptions = {}) {
  // FIXME: This is a bit of a hack; we use the "flag" title here so that
  // this can be used interchangably with "useDeleteBoardMutation".
  const mutationFn = (variables: {flag: ChannelLeave;}) =>
    api.poke(channelAction("quorum-leave", variables.flag));
  return useBoardMutation(mutationFn, options);
}

export function useEditBoardMutation(options: UseMutationOptions = {}) {
  const mutationFn = (variables: {flag: string; update: QuorumEditBoard;}) =>
    api.poke(quorumAction(variables.flag, {"edit-board": variables.update}));
  return useBoardMutation(mutationFn, options);
}

export function useDeleteBoardMutation(options: UseMutationOptions = {}) {
  const mutationFn = (variables: {flag: string}) =>
    api.poke(quorumAction(variables.flag, {"delete-board": null}));
  return useBoardMutation(mutationFn, options);
}

export function useNewThreadMutation(options: UseMutationOptions = {}) {
  const mutationFn = (variables: {flag: string; update: QuorumNewThread;}) =>
    api.poke(quorumAction(variables.flag, {"new-thread": variables.update}));
  return useBoardMutation(mutationFn, options);
}

export function useEditThreadMutation(options: UseMutationOptions = {}) {
  const mutationFn = (variables: {flag: string; update: QuorumEditThread;}) =>
    api.poke(quorumAction(variables.flag, {"edit-thread": variables.update}));
  return useBoardMutation(mutationFn, options);
}

export function useNewReplyMutation(options: UseMutationOptions = {}) {
  const mutationFn = (variables: {flag: string; update: QuorumNewReply;}) =>
    api.poke(quorumAction(variables.flag, {"new-reply": variables.update}));
  return useBoardMutation(mutationFn, options);
}

export function useEditPostMutation(options: UseMutationOptions = {}) {
  const mutationFn = (variables: {flag: string; update: QuorumEditPost;}) =>
    api.poke(quorumAction(variables.flag, {"edit-post": variables.update}));
  return useBoardMutation(mutationFn, options);
}

export function useDeletePostMutation(options: UseMutationOptions = {}) {
  const mutationFn = (variables: {flag: string; update: QuorumDeletePost;}) =>
    api.poke(quorumAction(variables.flag, {"delete-post": variables.update}));
  return useBoardMutation(mutationFn, options);
}

export function useVoteMutation(options: UseMutationOptions = {}) {
  const mutationFn = (variables: {flag: string; update: QuorumVote;}) =>
    api.poke(quorumAction(variables.flag, {"vote": variables.update}));
  return useBoardMutation(mutationFn, options);
}

export function useAddSectsMutation(options: UseMutationOptions = {}) {
  const mutationFn = (variables: {flag: string; update: QuorumDeltaSects}) =>
    api.poke(quorumAction(variables.flag, {"add-sects": variables.update}));
  return useBoardMutation(mutationFn, options);
}

export function useDelSectsMutation(options: UseMutationOptions = {}) {
  const mutationFn = (variables: {flag: string; update: QuorumDeltaSects}) =>
    api.poke(quorumAction(variables.flag, {"del-sects": variables.update}));
  return useBoardMutation(mutationFn, options);
}

export function useRemarkMutation(options: UseMutationOptions = {}) {
  const mutationFn = (variables: {update: RemarkUpdate;}) =>
    api.poke(channelAction("quorum-remark-action", variables.update));
  return useBoardMutation(mutationFn, options);
}
