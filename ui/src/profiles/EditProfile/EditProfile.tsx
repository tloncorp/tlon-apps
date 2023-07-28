import React, { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import _ from 'lodash';
import { FormProvider, useForm } from 'react-hook-form';
import { ViewProps } from '@/types/groups';
import {
  Contact,
  ContactEditField,
  ContactAddGroup,
  ContactDelGroup,
} from '@/types/contact';
import useContactState, { useOurContact } from '@/state/contact';
import { useGroups } from '@/state/groups';
import Avatar from '@/components/Avatar';
import ShipName from '@/components/ShipName';
import GroupSelector, { GroupOption } from '@/components/GroupSelector';
import { useAnalyticsEvent } from '@/logic/useAnalyticsEvent';
import { useIsMobile } from '@/logic/useMedia';
import Layout from '@/components/Layout/Layout';
import { Link } from 'react-router-dom';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import ProfileFields from './ProfileFields';
import ProfileCoverImage from '../ProfileCoverImage';
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
        } as ContactEditField)
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
    <div className="flex grow overflow-y-scroll bg-gray-50">
      <Helmet>
        <title>{title}</title>
      </Helmet>
      <Layout
        header={
          isMobile ? (
            <div className="flex items-center justify-between border-b-2 border-gray-50 bg-white py-2 pl-2 pr-4">
              <Link
                to=".."
                className="default-focus ellipsis w-max-sm inline-flex h-10 appearance-none items-center justify-center space-x-2 rounded p-2"
              >
                <div className="flex h-6 w-6 items-center justify-center">
                  <CaretLeft16Icon className="h-5 w-5 shrink-0 text-gray-600" />
                </div>
                <div className="flex w-full flex-col justify-center">
                  <span className="ellipsis text-sm font-bold line-clamp-1 sm:font-semibold">
                    Edit Profile
                  </span>
                </div>
              </Link>
            </div>
          ) : null
        }
        className="flex-1"
      >
        <EditProfileContent />
      </Layout>
    </div>
  );
}
