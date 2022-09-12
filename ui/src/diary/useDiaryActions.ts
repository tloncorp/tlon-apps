import { citeToPath } from '@/logic/utils';
import { useDiaryState } from '@/state/diary';
import { decToUd } from '@urbit/api';
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useCopyToClipboard } from 'usehooks-ts';

interface useDiaryActionsParams {
  flag: string;
  time: string;
}

export default function useDiaryActions({ flag, time }: useDiaryActionsParams) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const [_copied, doCopy] = useCopyToClipboard();
  const [justCopied, setJustCopied] = useState(false);

  const delNote = useCallback(async () => {
    await useDiaryState.getState().delNote(flag, decToUd(time));
    navigate('../');
  }, [flag, time, navigate]);

  const onCopy = useCallback(
    (e) => {
      e.preventDefault();
      doCopy(
        citeToPath({
          chan: {
            nest: `diary/${flag}`,
            where: `/note/${time}`,
          },
        })
      );
      setJustCopied(true);
      setTimeout(() => {
        setJustCopied(false);
        setIsOpen(false);
      }, 1000);
    },
    [doCopy, time, flag]
  );

  return {
    isOpen,
    justCopied,
    setIsOpen,
    onCopy,
    delNote,
  };
}
