import { ChatMap } from '@tloncorp/shared/dist/urbit/channel';
import bigInt from 'big-integer';
import { ChangeEvent, KeyboardEvent, useCallback, useState } from 'react';
import { useNavigate } from 'react-router';

import useDebounce from '@/logic/useDebounce';

export interface Selection {
  index: number;
  time: bigInt.BigInteger;
}

interface onNavigateParams extends Selection {
  setSelected: (selection: Selection) => void;
}

interface useChatSearchInputParams {
  root: string;
  query?: string;
  scan: ChatMap;
  onNavigate: (params: onNavigateParams) => void;
}

export function useChatSearchInput({
  root,
  query,
  scan,
  onNavigate,
}: useChatSearchInputParams) {
  const navigate = useNavigate();
  const [rawInput, setRawInput] = useState(query || '');
  const [selected, setSelected] = useState<Selection>({
    index: -1,
    time: bigInt.zero,
  });
  const debouncedSearch = useDebounce((input: string) => {
    if (!input) {
      navigate(`${root}/search`);
      return;
    }

    navigate(`${root}/search/${input}`);
  }, 500);

  const onChange = useCallback(
    (newValue: string) => {
      setRawInput(newValue);
      debouncedSearch(newValue);
    },
    [debouncedSearch]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLLabelElement>) => {
      if (event.key === 'Escape') {
        navigate(root);
      }

      if (event.key === 'Enter' && selected.index >= 0) {
        const { time } = selected;
        const scrollTo = `?msg=${time.toString()}`;
        const to = `${root}${scrollTo}`;
        navigate(to);
      }

      const arrow = event.key === 'ArrowDown' || event.key === 'ArrowUp';
      if (!arrow || scan.size === 0) {
        return;
      }

      event.preventDefault();
      const next = event.key === 'ArrowDown' ? 1 : -1;
      const index =
        selected === undefined
          ? 0
          : (selected.index + next + scan.size) % scan.size;
      const time = [...scan.keys()][index];
      onNavigate({ index, time, setSelected });
    },
    [root, selected, scan, navigate, onNavigate]
  );

  return {
    rawInput,
    selected,
    onChange,
    onKeyDown,
  };
}
