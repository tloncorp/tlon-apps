import React, { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import {
  Contact,
  ContactEditFieldPrim,
  ContactEditField,
  ContactUpdate,
} from '@urbit/api';
import { useOurContact, isOurContactPublic } from '@/state/contact';
import { useGroup, useGroupState, useRouteGroup } from '@/state/groups';
import { GroupFormSchema, GroupMeta } from '@/types/groups';
import { useNavigate } from 'react-router';
import useNavStore from '@/components/Nav/useNavStore';
import { getGroupPrivacy } from '@/logic/utils';
import Avatar from '@/components/Avatar';
import ShipName from '@/components/ShipName';
import ProfileFields from './ProfileFields';
import ProfileCoverImage from '../ProfileCoverImage';


// const emptyMeta = {
//   title: '',
//   description: '',
//   image: '',
//   color: '',
// };

interface ProfileFormSchema extends ContactEditField {
  isContactPublic: boolean;
}

const emptyContact = {
  nickname: '',
  bio: '',
  status: '',
  color: '#000000',
  avatar: null,
  cover: null,
  isContactPublic: true,
};

export default function EditProfile() {
  // const navigate = useNavigate();
  // const groupFlag = useRouteGroup();
  // const group = useGroup(groupFlag);
  // const [deleteField, setDeleteField] = useState('');
  const ship = window.our;
  const contact = useOurContact();
  const isPublic = isOurContactPublic();

  const form = useForm<ProfileFormSchema>({
    defaultValues: {
      ...emptyContact,
      ...contact,
      isContactPublic: isPublic,
    },
  });

  useEffect(() => {
    form.reset({
      ...emptyContact,
      ...contact,
      isContactPublic: isPublic,
    });
  }, [form, contact, isPublic]);

  // const onDeleteChange = useCallback(
  //   (event: ChangeEvent<HTMLInputElement>) => {
  //     const { value } = event.target;
  //     setDeleteField(value);
  //   },
  //   [setDeleteField]
  // );

  // const onDelete = useCallback(() => {
  //   useGroupState.getState().delete(groupFlag);
  //   navigate('/');
  //   useNavStore.getState().navigatePrimary('main');
  // }, [groupFlag, navigate]);

  const onSubmit = useCallback(
    (values: ProfileFormSchema) => {
      console.log(values);
      // useGroupState.getState().edit(groupFlag, values);
    },
    []
  );

  return (
    <>
      <FormProvider {...form}>
        <ProfileCoverImage className="flex items-end rounded-b-lg" ship={ship}>
          <Avatar ship={ship} size="huge" className="translate-y-9" />
        </ProfileCoverImage>
        <div className="p-5 pt-14">
          <div className="text-lg font-bold">
            <ShipName name={ship} showAlias />
          </div>
        </div>
        <form
          className="card mb-4 space-y-4"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <ProfileFields />
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
      {/* <div className="card">
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
      </div> */}
    </>
  );
}