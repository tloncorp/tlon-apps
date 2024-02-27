import {
  Contact,
  ContactAddGroup,
  ContactDelGroup,
  ContactEditField,
} from '@tloncorp/shared/dist/urbit/contact';
import { ViewProps } from '@tloncorp/shared/dist/urbit/groups';
import _ from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { FormProvider, useForm } from 'react-hook-form';

import Avatar from '@/components/Avatar';
import GroupSelector, { GroupOption } from '@/components/GroupSelector';
import Layout from '@/components/Layout/Layout';
import MobileHeader from '@/components/MobileHeader';
import ShipName from '@/components/ShipName';
import { useAnalyticsEvent } from '@/logic/useAnalyticsEvent';
import { useIsMobile } from '@/logic/useMedia';
import useContactState, { useOurContact } from '@/state/contact';
import { useGroups } from '@/state/groups';
import { useProfileIsPublic } from '@/state/profile/profile';

import ProfileCoverImage from '../ProfileCoverImage';
import PublicProfileSelector from '../PublicProfileSelector';
import ProfileFields from './ProfileFields';
import ProfileGroup from './ProfileGroup';

interface ProfileFormSchema extends Omit<Contact, 'groups'> {
  groups: GroupOption[];
}

const onFormSubmit = (values: ProfileFormSchema, contact: Contact) => {
  const fields = Object.entries(values as ProfileFormSchema)
    .filter(
      ([key, value]) =>
        key !== 'groups' && value !== contact[key as keyof Contact]
    )
    .map(
      ([key, value]) =>
        ({
          [key]: key !== 'color' ? value : value.replace('#', ''),
        }) as ContactEditField
    );

  const toRemove: ContactDelGroup[] = _.difference(
    contact?.groups || [],
    values.groups.map((group) => group.value)
  ).map((v) => ({ 'del-group': v }));
  const toAdd: ContactAddGroup[] = _.difference(
    values.groups.map((group) => group.value),
    contact?.groups || []
  ).map((v) => ({ 'add-group': v }));
  useContactState.getState().edit(fields.concat(toRemove, toAdd));
};

function EditProfileContent() {
  const profileIsPublic = useProfileIsPublic();
  const isMobile = useIsMobile();
  const [allGroups, setAllGroups] = useState<GroupOption[]>([]);
  const groupData = useGroups();
  const groupFlags = Object.keys(groupData);
  const ship = window.our;
  const contact = useOurContact();

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
      ...contact,
      groups: objectifyGroups(contact?.groups || []),
    },
  });

  useEffect(() => {
    const groupOptions = objectifyGroups(contact?.groups || []);
    form.setValue('groups', groupOptions);
  }, [contact, groupData, form, objectifyGroups]);

  useEffect(() => {
    form.reset({
      ...contact,
      groups: objectifyGroups(contact?.groups || []),
    });
  }, [form, contact, objectifyGroups]);

  const onSubmit = useCallback(
    (values: ProfileFormSchema) => {
      onFormSubmit(values, contact);
      form.reset(values);
    },
    [contact, form]
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
    previewColor: form.watch('color') || contact.color,
    previewAvatar: form.watch('avatar') || '',
  };

  const watchCover = form.watch('cover');

  return (
    <div className="w-full p-6">
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

        {!isMobile && profileIsPublic && (
          <div className="card mb-4">
            <div className="max-w-lg">
              <PublicProfileSelector isMobile={false} />
            </div>
          </div>
        )}

        <div className="card">
          <form
            className="flex flex-col space-y-8"
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
        </div>
      </FormProvider>
    </div>
  );
}

export default function EditProfile({ title }: ViewProps) {
  useAnalyticsEvent('profile_edit');
  const isMobile = useIsMobile();

  return (
    <Layout
      header={
        isMobile ? (
          <MobileHeader title="Edit Profile" pathBack="/profile" />
        ) : null
      }
      className="w-full bg-gray-50"
    >
      <Helmet>
        <title>{title}</title>
      </Helmet>
      <div className="h-full grow overflow-scroll">
        <EditProfileContent />
      </div>
    </Layout>
  );
}
