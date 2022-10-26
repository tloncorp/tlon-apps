import React, { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import Dialog, {
  DialogClose,
  DialogContent,
  DialogTrigger,
} from '@/components/Dialog';
import { useGroup, useGroupState, useRouteGroup } from '@/state/groups';
import {
  GroupFormSchema,
  GroupMeta,
  PrivacyType,
  ViewProps,
} from '@/types/groups';
import useGroupPrivacy from '@/logic/useGroupPrivacy';
import GroupInfoFields from '../GroupInfoFields';
import PrivacySelector from '../PrivacySelector';

const emptyMeta = {
  title: '',
  description: '',
  image: '',
  cover: '',
};

function eqGroupName(a: string, b: string) {
  return a.toLocaleLowerCase() === b.toLocaleLowerCase();
}

export default function GroupInfoEditor({ title }: ViewProps) {
  const navigate = useNavigate();
  const groupFlag = useRouteGroup();
  const group = useGroup(groupFlag);
  const [deleteField, setDeleteField] = useState('');
  const { privacy } = useGroupPrivacy(groupFlag);

  const form = useForm<GroupFormSchema>({
    defaultValues: {
      ...emptyMeta,
      ...group?.meta,
      privacy,
    },
  });

  useEffect(() => {
    form.reset({
      ...emptyMeta,
      ...group?.meta,
      privacy,
    });
  }, [group, form, privacy]);

  const onDeleteChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      setDeleteField(value);
    },
    [setDeleteField]
  );

  const onDelete = useCallback(() => {
    useGroupState.getState().delete(groupFlag);
    navigate('/');
  }, [groupFlag, navigate]);

  const onSubmit = useCallback(
    async (values: GroupMeta & { privacy: PrivacyType }) => {
      await useGroupState.getState().edit(groupFlag, values);

      const privacyChanged = values.privacy !== privacy;
      if (privacyChanged) {
        await useGroupState.getState().swapCordon(
          groupFlag,
          values.privacy === 'public'
            ? {
                open: {
                  ships: [],
                  ranks: [],
                },
              }
            : {
                shut: {
                  pending: [],
                  ask: [],
                },
              }
        );
        await useGroupState
          .getState()
          .setSecret(groupFlag, values.privacy === 'secret');
      }
    },
    [groupFlag, privacy]
  );

  return (
    <>
      <Helmet>
        <title>
          {group?.meta ? `Info for ${group.meta.title} ${title}` : title}
        </title>
      </Helmet>
      <FormProvider {...form}>
        <form
          className="card mb-4 space-y-4"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <h2 className="text-lg font-bold">Group Info</h2>
          <GroupInfoFields />
          <div>
            <h2 className="mb-2 font-semibold">Set Privacy*</h2>
            <PrivacySelector />
          </div>
          <footer className="flex items-center justify-end space-x-2">
            <button
              type="button"
              className="secondary-button"
              disabled={!form.formState.isDirty}
              onClick={() => form.reset()}
            >
              Reset
            </button>
            <button
              type="submit"
              className="button"
              disabled={!form.formState.isDirty}
            >
              Save
            </button>
          </footer>
        </form>
      </FormProvider>
      <div className="card">
        <h2 className="mb-1 text-lg font-bold">Delete Group</h2>
        <p className="mb-4">
          Deleting this group will permanently remove all content and members
        </p>
        <Dialog>
          <DialogTrigger className="button bg-red text-white dark:text-black">
            Delete {group?.meta.title}
          </DialogTrigger>
          <DialogContent containerClass="max-w-[420px]">
            <h2 className="mb-4 text-lg font-bold">Delete Group</h2>
            <p className="mb-4">
              Type the name of the group to confirm deletion. This action is
              irreversible.
            </p>
            <input
              className="input mb-9 w-full"
              placeholder="Name"
              value={deleteField}
              onChange={onDeleteChange}
            />
            <div className="flex justify-end">
              <DialogClose
                className="button bg-red text-white dark:text-black"
                disabled={!eqGroupName(deleteField, group?.meta.title || '')}
                onClick={onDelete}
              >
                Delete
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
