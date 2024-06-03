import cn from 'classnames';
import {
  PropsWithChildren,
  useEffect,
  useState,
} from 'react';
import { useNavigate } from 'react-router';

import ActionMenu, { Action } from '@/components/ActionMenu';
import Dialog from '@/components/Dialog';
import EllipsisIcon from '@/components/icons/EllipsisIcon';
import { useIsMobile } from '@/logic/useMedia';

import BroadcastInviteDialog from './BroadcastInviteDialog';
import { modifyCohort } from '@/state/broadcasts';

type DMOptionsProps = PropsWithChildren<{
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onLeave?: () => void;
  whom: string;
  pending: boolean;
  isHovered?: boolean;
  className?: string;
  isMulti?: boolean;
  alwaysShowEllipsis?: boolean;
  triggerDisabled?: boolean;
}>;

export default function BroadcastOptions({
  open = false,
  onOpenChange,
  whom,
  alwaysShowEllipsis = false,
  triggerDisabled,
  className,
  children,
}: DMOptionsProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [isOpen, setIsOpen] = useState(open);
  const handleOpenChange = (innerOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(innerOpen);
    } else {
      setIsOpen(innerOpen);
    }
  };

  useEffect(() => {
    setIsOpen(open);
  }, [open]);

  const [inviteMode, setInviteMode] = useState('add' as ('add' | 'del'));
  const [inviteIsOpen, setInviteIsOpen] = useState(false);
  const handleAdd = () => {
    setInviteMode('add');
    setInviteIsOpen(true);
  }
  const handleDel = () => {
    setInviteMode('del');
    setInviteIsOpen(true);
  }

  const [dialog, setDialog] = useState(false);

  const onDelete = async () => {
    const after = () => { navigate('/messages') };
    modifyCohort(whom, false, [], after);
  };
  const closeDialog = () => {
    setDialog(false);
  };

  const actions: Action[] = [];

  actions.push({
    key: 'add',
    onClick: handleAdd,
    content: 'Add Ships',
  });
  actions.push({
    key: 'del',
    onClick: handleDel,
    content: 'Remove Ships',
  });

  actions.push({
    key: 'delete',
    type: 'destructive',
    onClick: () => setDialog(true),
    content: 'Delete Cohort',
  });

  return (
    <>
      <ActionMenu
        open={isOpen}
        onOpenChange={handleOpenChange}
        actions={actions}
        disabled={triggerDisabled}
        asChild={!triggerDisabled}
        className={className}
      >
        {!alwaysShowEllipsis && children ? (
          children
        ) : (
          <div className={cn('relative h-6 w-6 text-gray-600', className)}>
            {!isMobile && (
              <button
                className={cn(
                  'default-focus absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg p-0.5 transition-opacity focus-within:opacity-100 hover:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100',
                  isOpen || alwaysShowEllipsis ? 'opacity:100' : 'opacity-0'
                )}
                aria-label="Open Message Options"
              >
                <EllipsisIcon className="h-6 w-6 text-inherit" />
              </button>
            )}
          </div>
        )}
      </ActionMenu>
      <Dialog open={dialog} onOpenChange={setDialog} containerClass="max-w-md">
        <div className="flex flex-col">
          <h2 className="mb-4 text-lg font-bold">Delete Cohort</h2>
          <p className="mb-7 leading-5">
            Are you sure you want to delete this broadcast? Deleting will
            remove this collection of ships and its history, but will not
            un-send previously broadcasted messages.
          </p>
          <div className="flex items-center justify-end space-x-2">
            <button onClick={closeDialog} className="button" type="button">
              Cancel
            </button>

            <button
              onClick={onDelete}
              className="button bg-red text-white"
              type="button"
            >
              Delete Cohort
            </button>
          </div>
        </div>
      </Dialog>
      <BroadcastInviteDialog
        mode={inviteMode}
        inviteIsOpen={inviteIsOpen}
        setInviteIsOpen={setInviteIsOpen}
        whom={whom}
        create={false}
      />
    </>
  );
}
