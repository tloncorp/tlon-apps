/* eslint-disable import/prefer-default-export */
import { useMemo } from 'react';
import { useParams } from 'react-router';

export function useChannelFlag() {
  const { chShip, chName } = useParams();
  return useMemo(
    () => (chShip && chName ? `${chShip}/${chName}` : null),
    [chShip, chName]
  );
}
