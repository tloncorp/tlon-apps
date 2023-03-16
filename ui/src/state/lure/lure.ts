import api from '@/api';
import { useState, useEffect } from 'react';
import { useEffectOnce } from 'usehooks-ts';
import { useGroupFlag } from '../groups';

export function useLureBait() {
  const [lureBait, setLureBait] = useState('');
  useEffectOnce(() => {
    api
      .scry<{ url: string; ship: string }>({
        app: 'reel',
        path: '/bait',
      })
      .then((result) => setLureBait(result.url));
  });

  return lureBait;
}

export function useLureEnabled(flag: string): [boolean, (b: boolean) => void] {
  const [lureEnabled, setLureEnabled] = useState<boolean>(false);
  const currentFlag = useGroupFlag();

  useEffect(() => {
    if (flag === currentFlag) {
      api
        .subscribeOnce('grouper', `/group-enabled/${flag}`, 20000)
        .then((result) => setLureEnabled(result));
    }
  }, [flag, currentFlag]);

  return [lureEnabled, setLureEnabled];
}

export function useLureMetadataExists(
  name: string,
  lureURL: string
): [boolean, () => void] {
  const [lureMetadataExists, setLureMetadataExists] = useState<boolean>(false);

  function checkLureMetadataExists() {
    api
      .scry<{ tag: string; fields: any }>({
        app: 'reel',
        path: `/metadata/${name}`,
      })
      .then((result) => setLureMetadataExists(result.tag !== ''));
  }

  useEffect(checkLureMetadataExists, [name, lureURL]);

  return [lureMetadataExists, checkLureMetadataExists];
}

export function useLureWelcome(name: string): [string, (s: string) => void] {
  const [lureWelcome, setLureWelcome] = useState<string>(
    'Write a welcome message for your group'
  );

  useEffectOnce(() => {
    api
      .scry<{ tag: string; fields: any }>({
        app: 'reel',
        path: `/metadata/${name}`,
      })
      .then((result) => setLureWelcome(result.fields.welcome));
  });

  return [lureWelcome, setLureWelcome];
}

export function useGroupInviteUrl(flag: string): [string, () => void] {
  const [url, setUrl] = useState<string>('');
  const currentFlag = useGroupFlag();

  function checkInviteUrl() {
    if (flag === currentFlag) {
      api.subscribeOnce('reel', `/token-link/${flag}`, 20000).then((result) => {
        setUrl(result);
      });
    }
  }

  useEffect(checkInviteUrl, [flag, currentFlag]);

  return [url, checkInviteUrl];
}

export async function lurePokeDescribe(token: string, metadata: any) {
  await api.poke({
    app: 'reel',
    mark: 'reel-describe',
    json: {
      token,
      metadata,
    },
  });
}

export async function lureEnableGroup(name: string) {
  await api.poke({
    app: 'grouper',
    mark: 'grouper-enable',
    json: name,
  });
}

export async function lureDisableGroup(name: string) {
  await api.poke({
    app: 'grouper',
    mark: 'grouper-disable',
    json: name,
  });
}
