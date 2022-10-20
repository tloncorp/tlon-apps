import { citeToPath, useCopy } from '@/logic/utils';
import { useDiaryState } from '@/state/diary';
import { decToUd } from '@urbit/api';
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';

interface useDiaryActionsParams {
  flag: string;
  time: string;
}

export default function useDiaryActions({ flag, time }: useDiaryActionsParams) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { doCopy, didCopy } = useCopy(
    citeToPath({
      chan: {
        nest: `diary/${flag}`,
        where: `/note/${time}`,
      },
    })
  );

  const delNote = useCallback(async () => {
    await useDiaryState.getState().delNote(flag, decToUd(time));
    navigate('../');
  }, [flag, time, navigate]);

  const onCopy = useCallback(
    (e) => {
      e.preventDefault();
      doCopy();
    },
    [doCopy]
  );

  return {
    isOpen,
    didCopy,
    setIsOpen,
    onCopy,
    delNote,
  };
}
