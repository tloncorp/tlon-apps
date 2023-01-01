import React, { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import _ from 'lodash';
import { FormProvider, useForm } from 'react-hook-form';
import { Contact, ContactEditField, uxToHex } from '@urbit/api';
import { ViewProps } from '@/types/groups';
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
  isContactPrivate: boolean;
  groups: GroupOption[];
}

const emptyContact = {
  nickname: '',
  bio: '',
  status: '',
  color: '0x0',
  avatar: null,
  cover: null,
  groups: [] as GroupOption[],
  isContactPrivate: false,
};

const onFormSubmit = (
  values: ProfileFormSchema,
  contact: Contact | undefined,
  ship: string
) => {
  if (!contact) {
    return;
  }

  const resourceifyGroup = (group: string) => {
    const groupFlag = group.replace('/ship/', '');
    const groupResource = {
      name: groupFlag.split('/')[1],
      ship: groupFlag.split('/')[0] || '',
    };
    return groupResource;
  };

  Object.entries(values as ProfileFormSchema).forEach((formValue) => {
    const [key, value] = formValue;
    const newValue = key !== 'color' ? value : uxToHex(value.replace('#', ''));
    if (value !== contact[key as keyof Contact]) {
      if (key === 'isContactPrivate') {
        // We're flipping the value here, Contact-store expects a checkbox called "Make Public" and Here we're using "Make Private"
        useContactState.getState().setContactPublic(!newValue);
      } else if (key === 'groups') {
        const toRemove: string[] = _.difference(
          contact?.groups || [],
          values.groups.map((group) => `/ship/${group.value}`)
        );
        const toAdd: string[] = _.difference(
          values.groups.map((group) => `/ship/${group.value}`),
          contact?.groups || []
        );
        toRemove.forEach((i) => {
          const group = resourceifyGroup(i);
          useContactState
            .getState()
            .editContactField(ship, { 'remove-group': group });
        });
        toAdd.forEach((i) => {
          const group = resourceifyGroup(i);
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
  const groupData = useGroups();
  const groupFlags = Object.keys(groupData);
  const ship = window.our;
  const contact = useOurContact();
  const isPublic = isOurContactPublic();

  const objectifyGroups = useCallback(
    (groups: string[]) => {
      const groupOptions = groups.map((groupFlag) => {
        // contact-store prepends "/ship/" to each group flag added to it, which is the correct URL path in groups 1, but not here
        const deShippedGroupFlag = groupFlag.replace('/ship/', '');
        return {
          value: deShippedGroupFlag,
          label: groupData[deShippedGroupFlag]?.meta.title,
        };
      });
      return groupOptions;
    },
    [groupData]
  );

  const form = useForm<ProfileFormSchema>({
    defaultValues: {
      ...emptyContact,
      ...contact,
      groups: objectifyGroups(contact?.groups || []),
      isContactPrivate: !isPublic,
    },
  });

  useEffect(() => {
    const groupOptions = objectifyGroups(contact?.groups || []);
    form.setValue('groups', groupOptions);
  }, [contact, groupData, form, objectifyGroups]);

  useEffect(() => {
    form.reset({
      ...emptyContact,
      ...contact,
      groups: objectifyGroups(contact?.groups || []),
      isContactPrivate: !isPublic,
    });
  }, [form, contact, objectifyGroups, isPublic]);

  const onSubmit = useCallback(
    (values: ProfileFormSchema) => {
      onFormSubmit(values, contact, ship);
      form.reset(values);
    },
    [contact, ship, form]
  );

  const uniqueGroupOptions = (groups: GroupOption[]) => {
    const result: GroupOption[] = [];
    const distinctValues = new Set();
    groups.forEach((group) => {
      if (!distinctValues.has(group.value)) {
        distinctValues.add(group.value);
        result.push(group);
      }
    });
    return result;
  };

  const onEnter = (values: GroupOption[]) => {
    const nextGroups = uniqueGroupOptions([
      ...form.getValues('groups'),
      ...values,
    ]);
    form.setValue('groups', nextGroups, { shouldDirty: true });
  };

  const onRemoveGroupClick = useCallback(
    (groupFlag: string) => {
      const newGroups = [...form.getValues('groups')].filter(
        (g) => g.value !== groupFlag
      );
      form.setValue('groups', newGroups, { shouldDirty: true });
    },
    [form]
  );

  const avatarPreviewData = {
    previewColor: form.watch('color') || emptyContact.color,
    previewAvatar: form.watch('avatar') || '',
  };

  const watchCover = form.watch('cover');

  return (
    <div className="w-full">
      <FormProvider {...form}>
        <div>
          <ProfileCoverImage
            className="flex items-end rounded-b-lg"
            cover={watchCover || ''}
          >
            <Avatar
              ship={ship}
              previewData={avatarPreviewData}
              icon={false}
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
              autoFocus={false}
              groups={allGroups}
              onEnter={onEnter}
              setGroups={setAllGroups}
              isMulti={false}
              isValidNewOption={(value) => groupFlags.includes(value)}
            />
            <div className="text-sm font-semibold text-gray-600">
              Share your favorite groups on your profile
            </div>
            <div className="flex flex-wrap pt-2">
              {form.watch('groups').map((group) => (
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

export default function EditProfile({ title }: ViewProps) {
  return (
    <div className="flex grow overflow-y-scroll bg-gray-50">
      <Helmet>
        <title>{title}</title>
      </Helmet>
      <div className="m-4 w-full sm:my-5 sm:mx-8">
        <EditProfileContent />
      </div>
    </div>
  );
}
