import { decToUd } from '@urbit/api';
import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { citeToPath, nestToFlag, useCopy } from '@/logic/utils';
import { useDeletePostMutation, usePostToggler } from '@/state/channel/channel';
import { useGroupFlag } from '@/state/groups';

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
  const flag = useGroupFlag();
  const [, chFlag] = nestToFlag(nest);
  const chanPath = citeToPath({
    chan: {
      nest,
      where: `/curio/${time}`,
    },
  });
  const { doCopy, didCopy } = useCopy(refToken ? refToken : chanPath);
  const { isHidden, show, hide } = usePostToggler(time);

  const [menuOpen, setMenuOpen] = useState(false);

  const { mutateAsync, isLoading: isDeleteLoading } = useDeletePostMutation();

  const onDelete = useCallback(async () => {
    setMenuOpen(false);
    try {
      await mutateAsync({ nest, time: decToUd(time) });
      navigate(`/groups/${flag}/channels/heap/${chFlag}`);
    } catch (err) {
      console.error('Failed to delete curio:', err);
    }
  }, [chFlag, time, mutateAsync, flag, navigate, nest]);

  const onEdit = useCallback(() => {
    setMenuOpen(false);
    navigate(`/groups/${flag}/channels/heap/${chFlag}/curio/${time}/edit`, {
      state: { backgroundLocation: location },
    });
  }, [location, navigate, time, flag, chFlag]);

  const navigateToCurio = useCallback(() => {
    navigate(`/groups/${refToken}`);
  }, [navigate, refToken]);

  const onCopy = useCallback(() => {
    doCopy();
    setTimeout(() => {
      setMenuOpen(false);
    }, 1000);
  }, [doCopy]);

  const toggleHidden = useCallback(() => {
    if (isHidden) {
      show();
    } else {
      hide();
    }
  }, [isHidden, show, hide]);

  const reportContent = useCallback(() => {
    navigate('/report-content', {
      state: {
        backgroundLocation: location,
        post: time,
        reply: null,
        nest,
        groupFlag: flag,
      },
    });
    hide();
  }, [navigate, hide, location, nest, time, flag]);

  return {
    didCopy,
    menuOpen,
    setMenuOpen,
    onDelete,
    isDeleteLoading,
    onEdit,
    onCopy,
    navigateToCurio,
    isHidden,
    toggleHidden,
    reportContent,
  };
}
