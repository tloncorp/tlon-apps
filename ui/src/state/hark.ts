import _ from 'lodash';
import {
  Blanket,
  Carpet,
  Flag,
  HarkAction,
  Rope,
  Seam,
  Skein,
} from '@/types/hark';
import api, { useSubscriptionState } from '@/api';
import { decToUd } from '@urbit/api';
import useReactQuerySubscription from '@/logic/useReactQuerySubscription';
import { useMutation, useQueryClient } from '@tanstack/react-query';

function harkAction(action: HarkAction) {
  return {
    app: 'hark',
    mark: 'hark-action',
    json: action,
  };
}

export function useCarpet(flag?: Flag) {
  const { data, ...rest } = useReactQuerySubscription({
    queryKey: ['carpet', flag],
    app: 'hark',
    path: '/ui',
    initialScryPath: flag
      ? `/group/${flag}/latest`
      : `/desk/${window.desk}/latest`,
  });

  return {
    data: data as Carpet,
    ...rest,
  };
}

export function useBlanket(flag?: Flag) {
  const { data: carpet, isSuccess } = useCarpet(flag);
  const quilt = isSuccess
    ? carpet?.stitch === 0
      ? '0'
      : decToUd(carpet?.stitch?.toString() ?? '0')
    : '0';
  const { data, ...rest } = useReactQuerySubscription({
    queryKey: ['blanket', flag],
    app: 'hark',
    path: '/ui',
    initialScryPath: flag
      ? `/group/${flag}/quilt/${quilt}`
      : `/desk/${window.desk}/quilt/${quilt}`,
    enabled: isSuccess,
  });

  return {
    data: data as Blanket,
    ...rest,
  };
}

export function useSkeins(flag?: Flag) {
  const { data, ...rest } = useReactQuerySubscription({
    queryKey: ['skeins', flag],
    app: 'hark',
    path: '/ui',
    initialScryPath: flag
      ? `/group/${flag}/skeins`
      : `/desk/${window.desk}/skeins`,
  });

  return {
    data: data as Skein[],
    ...rest,
  };
}

export function useSawRopeMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: { rope: Rope; update?: boolean }) =>
    new Promise<void>((resolve, reject) => {
      api.poke({
        ...harkAction({
          'saw-rope': variables.rope,
        }),
        onError: reject,
        onSuccess: async () => {
          if (!variables.update) {
            resolve();
            return;
          }

          await useSubscriptionState
            .getState()
            .track(
              'hark/ui',
              (event: HarkAction) =>
                'saw-rope' in event &&
                event['saw-rope'].thread === variables.rope.thread
            );
          resolve();
        },
      });
    });

  return useMutation(mutationFn, {
    onMutate: async (variables) => {
      await queryClient.cancelQueries(['carpet', variables.rope.group]);
      await queryClient.cancelQueries(['blanket', variables.rope.group]);
    },
    onSettled: async (_data, _error, variables) => {
      await queryClient.invalidateQueries(['carpet', variables.rope.group]);
      await queryClient.invalidateQueries(['blanket', variables.rope.group]);
    },
  });
}

export function useSawSeamMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: { seam: Seam }) =>
    new Promise<void>((resolve, reject) => {
      api.poke({
        ...harkAction({
          'saw-seam': variables.seam,
        }),
        onError: reject,
        onSuccess: async () => {
          await useSubscriptionState
            .getState()
            .track(
              'hark/ui',
              (event: HarkAction) =>
                'saw-seam' in event &&
                _.isEqual(event['saw-seam'], variables.seam)
            );
          resolve();
        },
      });
    });

  return useMutation(mutationFn, {
    onMutate: async () => {
      await queryClient.cancelQueries(['carpet']);
      await queryClient.cancelQueries(['blanket']);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries(['carpet']);
      await queryClient.invalidateQueries(['blanket']);
    },
  });
}
