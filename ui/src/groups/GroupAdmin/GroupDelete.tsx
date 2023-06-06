import React, { ChangeEvent, useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import Dialog, { DialogClose } from '@/components/Dialog';
import {
  useDeleteGroupMutation,
  useGroup,
  useRouteGroup,
} from '@/state/groups';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';

const removeSpecialChars = (s: string) =>
  s.toLocaleLowerCase().replace(/[^\w\s]/gi, '');

function eqGroupName(a: string, b: string) {
  return removeSpecialChars(a) === removeSpecialChars(b);
}

function GroupDelete() {
  const navigate = useNavigate();
  const groupFlag = useRouteGroup();
  const group = useGroup(groupFlag);
  const [deleteField, setDeleteField] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const onDeleteChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      setDeleteField(value);
    },
    [setDeleteField]
  );

  const { mutate: deleteMutation, status: deleteStatus } =
    useDeleteGroupMutation();

  const onDelete = useCallback(async () => {
    try {
      deleteMutation({ flag: groupFlag });
      setDeleteDialogOpen(false);
      navigate('/');
    } catch (e) {
      console.log("GroupInfoEditor: couldn't delete group", e);
    }
  }, [groupFlag, navigate, deleteMutation]);

  return (
    <div className="card">
      <h2 className="mb-2 text-lg font-bold">Delete Group</h2>
      <p className="mb-4 text-gray-600">
        Deleting this group will permanently remove all content and members.
      </p>
      <button
        onClick={() => setDeleteDialogOpen(true)}
        className="button bg-red text-white dark:text-black"
      >
        Delete {group?.meta.title}
      </button>
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => setDeleteDialogOpen(open)}
        close="none"
        containerClass="max-w-[420px]"
      >
        <h2 className="mb-2 text-lg font-bold text-red">Delete Group</h2>
        <p className="mb-4 leading-5 text-red">
          Type the name of the group to confirm deletion. This action is
          irreversible.
        </p>
        <input
          className="input mb-9 w-full"
          placeholder="Name"
          value={deleteField}
          onChange={onDeleteChange}
        />
        <div className="flex justify-end space-x-2">
          <DialogClose className="secondary-button">Cancel</DialogClose>
          <DialogClose
            className="button bg-red text-white dark:text-black"
            disabled={!eqGroupName(deleteField, group?.meta.title || '')}
            onClick={onDelete}
          >
            {deleteStatus === 'loading' ? (
              <LoadingSpinner />
            ) : deleteStatus === 'error' ? (
              'Error'
            ) : (
              'Delete'
            )}
          </DialogClose>
        </div>
      </Dialog>
    </div>
  );
}

export default GroupDelete;
