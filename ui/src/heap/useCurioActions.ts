import { nestToFlag, citeToPath, useCopy } from '@/logic/utils';
import { useHeapState } from '@/state/heap/heap';
import { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router';

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
  const chanPath = citeToPath({
    chan: {
      nest: `heap/${chFlag}`,
      where: `/curio/${time}`,
    },
  });
  const { doCopy, didCopy } = useCopy(refToken ? refToken : chanPath);

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
    doCopy();
  }, [doCopy]);

  return {
    didCopy,
    menuOpen,
    setMenuOpen,
    onDelete,
    onEdit,
    onCopy,
    navigateToCurio,
  };
}
