import { nestToFlag, citeToPath } from '@/logic/utils';
import { useHeapState } from '@/state/heap/heap';
import { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useCopyToClipboard } from 'usehooks-ts';

interface useCurioActionsProps {
  nest: string;
  time: string;
  refToken?: string;
}

export default function useCurioActions({
  nest,
  time,
  refToken,
}: useCurioActionsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [, chFlag] = nestToFlag(nest);
  const [, doCopy] = useCopyToClipboard();
  const [justCopied, setJustCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const onDelete = useCallback(() => {
    setMenuOpen(false);
    useHeapState.getState().delCurio(chFlag, time);
  }, [chFlag, time]);

  const onEdit = useCallback(() => {
    setMenuOpen(false);
    navigate(`curio/${time}/edit`, {
      state: { backgroundLocation: location },
    });
  }, [location, navigate, time]);

  const navigateToCurio = useCallback(() => {
    navigate(`/groups/${refToken}`);
  }, [navigate, refToken]);

  const onCopy = useCallback(() => {
    if (refToken) {
      doCopy(refToken);
    } else {
      doCopy(
        citeToPath({
          chan: {
            nest: `heap/${chFlag}`,
            where: `/curio/${time}`,
          },
        })
      );
    }
    setJustCopied(true);
    setTimeout(() => {
      setJustCopied(false);
    }, 1000);
  }, [doCopy, time, chFlag, refToken]);

  return {
    justCopied,
    menuOpen,
    setMenuOpen,
    onDelete,
    onEdit,
    onCopy,
    navigateToCurio,
  };
}
