import React, { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import {
  Contact,
  ContactEditFieldPrim,
  ContactEditField,
  ContactUpdate,
  hexToUx,
  uxToHex
} from '@urbit/api';
import useContactState, { useOurContact, isOurContactPublic } from '@/state/contact';
import Avatar from '@/components/Avatar';
import ShipName from '@/components/ShipName';
import ProfileFields from './ProfileFields';
import ProfileCoverImage from '../ProfileCoverImage';

interface ProfileFormSchema extends ContactEditField {
  isContactPublic: boolean;
}

const emptyContact = {
  nickname: '',
  bio: '',
  status: '',
  color: '0x0',
  avatar: null,
  cover: null,
  isContactPublic: true,
};

function EditProfileContent() {
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

  const onSubmit = useCallback(
    (values: ProfileFormSchema) => {
      if (!contact) {
        return;
      }

      Object.entries(values as ProfileFormSchema).forEach(formValue => {
        const [key, value]= formValue;
        const newValue = key !== 'color' ? value : uxToHex(value);
        if (value !== contact[key]) {
          if (key === 'isContactPublic') {
            useContactState.getState().setContactPublic(newValue);
          } else if (key === 'groups') {
            // handle group stuff
          } else {
            useContactState.getState().editContactField(ship, {[key]: newValue});
          }
        }
      });
    },
    [contact, ship]
  );

  const avatarPreviewData = {
    previewColor: form.watch('color') || emptyContact.color,
    previewAvatar: form.watch('avatar') || ''
  };

  return (
    <div className='w-full'>
      <FormProvider {...form}>
          <div>
            <ProfileCoverImage className="flex items-end rounded-b-lg" ship={ship}>
              <Avatar ship={ship} previewData={avatarPreviewData} size="huge" className="translate-y-9" />
            </ProfileCoverImage>
            <div className="p-5 pt-14">
              <div className="text-lg font-bold">
              <ShipName name={ship} showAlias />
              {contact?.nickname ? (
                <ShipName name={ship} className="ml-2 text-gray-600" />
              ) : null}
              </div>
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
                onClick={() => form.reset}
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
    </div>
  );
}

export default function EditProfile() {
  return(
          <div className='flex grow overflow-y-scroll bg-gray-50'>
            <div className='m-4 w-full sm:my-5 sm:mx-8'>
              <EditProfileContent />
            </div>
          </div>
        );
}