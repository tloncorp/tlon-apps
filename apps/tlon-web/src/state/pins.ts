import { useMutation } from '@tanstack/react-query';
import { Nest } from '@tloncorp/shared/dist/urbit/channel';
import _ from 'lodash';
import { useMemo } from 'react';

import api from '@/api';
import useReactQueryScry from '@/logic/useReactQueryScry';
import { whomIsDm, whomIsFlag, whomIsMultiDm, whomIsNest } from '@/logic/utils';
import queryClient from '@/queryClient';

export const pinsKey = () => ['groups-ui', 'pins'];

type Pin = string; // whom or nest or flag
type Pins = Pin[];

export function bootstrapPins(pins: Pins) {
  queryClient.setQueryData(pinsKey(), pins);
}

export function usePins(): Pins {
  const { data } = useReactQueryScry<{ pins: Pins }>({
    queryKey: pinsKey(),
    app: 'groups-ui',
    path: '/pins',
  });

  if (!data || !data.pins) {
    return queryClient.getQueryData(pinsKey()) || [];
  }

  return _.uniq(data.pins);
}

export function usePinnedChats(removeChannels?: boolean): Pins {
  const pins = usePins();

  return useMemo(
    () =>
      pins.filter(
        (pin) =>
          whomIsDm(pin) ||
          whomIsMultiDm(pin) ||
          (whomIsNest(pin) && !removeChannels)
      ),
    [pins, removeChannels]
  );
}

export function usePinnedClubs(): Pins {
  const pins = usePinnedChats();
  return useMemo(() => pins.filter(whomIsMultiDm), [pins]);
}

export function usePinnedChannels(): Nest[] {
  const pins = usePins();
  return useMemo(() => pins.filter(whomIsNest), [pins]);
}

export function useGroupPins(): Pins {
  const allPins = usePins();
  return useMemo(() => allPins.filter((pin) => whomIsFlag(pin)), [allPins]);
}

export function useAddPinMutation() {
  const pins = usePins();

  const mutationFn = async (variables: { pin: Pin }) => {
    await api.poke({
      app: 'groups-ui',
      mark: 'ui-action',
      json: {
        pins: {
          add: variables.pin,
        },
      },
    });
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(pinsKey());
      const newPins = _.uniq([...pins, variables.pin]);
      queryClient.setQueryData(pinsKey(), newPins);
    },
    onSettled: () => {
      queryClient.invalidateQueries(pinsKey());
    },
  });
}

export function useDeletePinMutation() {
  const pins = usePins();

  const mutationFn = async (variables: { pin: Pin }) => {
    await api.poke({
      app: 'groups-ui',
      mark: 'ui-action',
      json: {
        pins: {
          del: variables.pin,
        },
      },
    });
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(pinsKey());
      const newPins = pins.filter((pin) => pin !== variables.pin);
      queryClient.setQueryData(pinsKey(), newPins);
    },
    onSettled: () => {
      queryClient.invalidateQueries(pinsKey());
    },
  });
}
