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
import api from '@/api';
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
    scry: flag ? `/group/${flag}/latest` : `/desk/${window.desk}/latest`,
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
    scry: flag
      ? `/group/${flag}/quilt/${quilt}`
      : `/desk/${window.desk}/quilt/${quilt}`,
    options: { enabled: isSuccess },
  });

  return {
    data: data as Blanket,
    ...rest,
  };
}

export function useSkeins(flag?: Flag) {
  const { data, ...rest } = useReactQuerySubscription({
    queryKey: ['skeins', flag ? flag : window.desk],
    app: 'hark',
    path: '/ui',
    scry: flag ? `/group/${flag}/skeins` : `/desk/${window.desk}/skeins`,
    options: {
      refetchOnMount: true,
      retry: 1,
    },
  });

  return {
    data: data as Skein[],
    ...rest,
  };
}

export function useSawRopeMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: { rope: Rope; update?: boolean }) =>
    api.trackedPoke(
      harkAction({
        'saw-rope': variables.rope,
      }),
      { app: 'hark', path: '/ui' }
    );

  return useMutation(mutationFn, {
    onMutate: async (variables) => {
      await queryClient.cancelQueries(['skeins', variables.rope.group]);
    },
    onSettled: async (_data, _error, variables) => {
      await queryClient.invalidateQueries(['skeins', variables.rope.group]);
    },
  });
}

export function useSawSeamMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: { seam: Seam }) =>
    api.poke({
      ...harkAction({
        'saw-seam': variables.seam,
      }),
    });

  return useMutation(mutationFn, {
    onMutate: async (variables) => {
      if ('group' in variables.seam) {
        await queryClient.cancelQueries(['skeins', variables.seam.group]);
      } else {
        await queryClient.cancelQueries(['skeins', window.desk]);
      }
    },
    onSettled: async (_data, _error, variables) => {
      if ('group' in variables.seam) {
        await queryClient.invalidateQueries(['skeins', variables.seam.group]);
      } else {
        await queryClient.invalidateQueries(['skeins', window.desk]);
      }
    },
  });
}
