import useReactQueryScry from '@/logic/useReactQueryScry';
import { useMutation } from '@tanstack/react-query';
import queryClient from '@/queryClient';
import { whomIsDm, whomIsFlag, whomIsMultiDm, whomIsNest } from '@/logic/utils';
import { useEffect, useMemo } from 'react';
import api from '@/api';
import _ from 'lodash';
import { Groups } from '@/types/groups';
import { Nest } from '@/types/channel';
import { useGroups } from './groups';

const pinsKey = () => ['pins'];

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

  return data.pins;
}

export function usePinnedChats(removeChannels?: boolean): Pins {
  const pins = usePins();

  useEffect(() => {
    console.log(`group pins changed:`, pins);
  }, [pins]);

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

export function usePinnedGroups(): Groups {
  const pins = useGroupPins();
  const groups = useGroups();

  useEffect(() => {
    console.log(`group pins changed:`, pins);
  }, [pins]);

  return pins.reduce(
    (acc, pin) => ({ ...acc, [pin]: groups[pin] }),
    {} as Groups
  );
}

export function useAddPinMutation() {
  const pins = usePins();

  const mutationFn = async (variables: { pin: Pin }) => {
    console.log(`addding new pin: ${variables.pin}`);
    await api.poke({
      app: 'groups-ui',
      mark: 'pin-add',
      json: variables.pin,
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
    console.log(`removing existing pin: ${variables.pin}`);
    await api.poke({
      app: 'groups-ui',
      mark: 'pin-del',
      json: variables.pin,
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
