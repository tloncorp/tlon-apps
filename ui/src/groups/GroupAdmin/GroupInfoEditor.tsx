import React, { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { FormProvider, useForm } from 'react-hook-form';
import Dialog, {
  DialogClose,
  DialogContent,
  DialogTrigger,
} from '@/components/Dialog';
import { useGroup, useGroupState, useRouteGroup } from '@/state/groups';
import { GroupFormSchema, GroupMeta, ViewProps } from '@/types/groups';
import { useNavigate } from 'react-router';
import { getGroupPrivacy } from '@/logic/utils';
import GroupInfoFields from '@/groups/GroupInfoFields';
import PrivacySelector from '@/groups/PrivacySelector';
import { Status } from '@/logic/status';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';

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
  const [status, setStatus] = useState<Status>('initial');

  const form = useForm<GroupFormSchema>({
    defaultValues: {
      ...emptyMeta,
      ...group?.meta,
      privacy: (group && getGroupPrivacy(group.cordon)) || 'public',
    },
  });

  useEffect(() => {
    form.reset({
      ...emptyMeta,
      ...group?.meta,
      privacy: (group && getGroupPrivacy(group.cordon)) || 'public',
    });
  }, [group, form]);

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
    async (values: GroupMeta) => {
      setStatus('loading');
      try {
        await useGroupState.getState().edit(groupFlag, values);
        setStatus('success');
      } catch (e) {
        setStatus('error');
      }
    },
    [groupFlag]
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
              {status === 'loading' ? (
                <LoadingSpinner />
              ) : status === 'error' ? (
                'Error'
              ) : (
                'Save'
              )}
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
