import React, { useCallback, useEffect, useState } from 'react';
import _ from 'lodash';
import { FormProvider, useForm } from 'react-hook-form';
import { Contact, ContactEditField, uxToHex } from '@urbit/api';
import useContactState, {
  useOurContact,
  isOurContactPublic,
} from '@/state/contact';
import { useGroups } from '@/state/groups';
import Avatar from '@/components/Avatar';
import ShipName from '@/components/ShipName';
import GroupSelector, { GroupOption } from '@/components/GroupSelector';
import ProfileFields from './ProfileFields';
import ProfileCoverImage from '../ProfileCoverImage';
import ProfileGroup from './ProfileGroup';

interface ProfileFormSchema extends ContactEditField {
  isContactPublic: boolean;
  groups: GroupOption[];
}

const emptyContact = {
  nickname: '',
  bio: '',
  status: '',
  color: '0x0',
  avatar: null,
  cover: null,
  groups: [{}],
  isContactPublic: true,
};

const onFormSubmit = (
  values: ProfileFormSchema,
  contact: Contact | undefined,
  selectedGroups: GroupOption[],
  ship: string
) => {
  if (!contact) {
    return;
  }

  Object.entries(values as ProfileFormSchema).forEach((formValue) => {
    const [key, value] = formValue;
    const newValue = key !== 'color' ? value : uxToHex(value.replace('#', ''));
    if (value !== contact[key as keyof Contact]) {
      if (key === 'isContactPublic') {
        useContactState.getState().setContactPublic(newValue);
      } else if (key === 'groups') {
        const toRemove: string[] = _.difference(
          contact?.groups || [],
          selectedGroups.map((group) => `/ship/${group.value}`)
        );
        const toAdd: string[] = _.difference(
          selectedGroups.map((group) => `/ship/${group.value}`),
          contact?.groups || []
        );
        toRemove.forEach((i) => {
          const groupFlag = i.replace('/ship/', '');
          const group = {
            name: groupFlag.split('/')[1],
            ship: groupFlag.split('/')[0] || '',
          };
          useContactState
            .getState()
            .editContactField(ship, { 'remove-group': group });
        });
        toAdd.forEach((i) => {
          const groupFlag = i.replace('/ship/', '');
          const group = {
            name: groupFlag.split('/')[1],
            ship: groupFlag.split('/')[0] || '',
          };
          useContactState
            .getState()
            .editContactField(ship, { 'add-group': group });
        });
      } else {
        useContactState.getState().editContactField(ship, { [key]: newValue });
      }
    }
  });
};

function EditProfileContent() {
  const [allGroups, setAllGroups] = useState<GroupOption[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<GroupOption[]>([]);
  const groupData = useGroups();
  const groupFlags = Object.keys(groupData);
  const ship = window.our;
  const contact = useOurContact();
  const isPublic = isOurContactPublic();

  useEffect(() => {
    const groupOptions = contact?.groups.map((groupFlag) => {
      // contact-store prepends "/ship/" to each group flag added to it, which is the correct URL path in groups 1, but not here
      const deShippedGroupFlag = groupFlag.replace('/ship/', '');
      return {
        value: deShippedGroupFlag,
        label: groupData[deShippedGroupFlag]?.meta.title,
      };
    });
    setSelectedGroups(groupOptions || []);
  }, [contact, groupData]);

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
      onFormSubmit(values, contact, selectedGroups, ship);
      form.reset(values);
    },
    [contact, selectedGroups, ship, form]
  );

  const onEnter = (values: GroupOption[]) => {
    const newSelectedGroups = [...selectedGroups, ...values];
    setSelectedGroups(newSelectedGroups);
  };

  const onRemoveGroupClick = useCallback((groupFlag: string) => {
    setSelectedGroups((gs) => gs.filter((g) => g.value !== groupFlag));
  }, []);

  const avatarPreviewData = {
    previewColor: form.watch('color') || emptyContact.color,
    previewAvatar: form.watch('avatar') || '',
  };

  return (
    <div className="w-full">
      <FormProvider {...form}>
        <div>
          <ProfileCoverImage
            className="flex items-end rounded-b-lg"
            ship={ship}
          >
            <Avatar
              ship={ship}
              previewData={avatarPreviewData}
              size="huge"
              className="translate-y-9"
            />
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
          className="card mb-4 flex flex-col space-y-6"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <ProfileFields />
          <div className="flex flex-col space-y-2">
            <label htmlFor="groups" className="font-bold">
              Favorite Groups
            </label>
            <GroupSelector
              groups={allGroups}
              onEnter={onEnter}
              setGroups={setAllGroups}
              isMulti={false}
              isValidNewOption={(value) => groupFlags.includes(value)}
            />
            <div className="flex flex-wrap space-x-2 pt-2">
              {selectedGroups.map((group) => (
                <ProfileGroup
                  key={group.value}
                  groupFlag={group.value}
                  onRemoveGroupClick={onRemoveGroupClick}
                />
              ))}
            </div>
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
    </div>
  );
}

export default function EditProfile() {
  return (
    <div className="flex grow overflow-y-scroll bg-gray-50">
      <div className="m-4 w-full sm:my-5 sm:mx-8">
        <EditProfileContent />
      </div>
    </div>
  );
}
