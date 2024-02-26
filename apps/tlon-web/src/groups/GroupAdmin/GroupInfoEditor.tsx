import {
  GroupFormSchema,
  GroupMeta,
  PrivacyType,
  ViewProps,
} from '@tloncorp/shared/dist/urbit/groups';
import React, { useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { FormProvider, useForm } from 'react-hook-form';

import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import MobileHeader from '@/components/MobileHeader';
import Tooltip from '@/components/Tooltip';
import useGroupPrivacy from '@/logic/useGroupPrivacy';
import { useIsMobile } from '@/logic/useMedia';
import {
  useEditGroupMutation,
  useGroup,
  useGroupCompatibility,
  useGroupSetSecretMutation,
  useGroupSwapCordonMutation,
  useRouteGroup,
} from '@/state/groups';
import { useLure } from '@/state/lure/lure';

import GroupInfoFields from './GroupInfoFields';

const emptyMeta = {
  title: '',
  description: '',
  image: '',
  cover: '',
};

export default function GroupInfoEditor({ title }: ViewProps) {
  const groupFlag = useRouteGroup();
  const group = useGroup(groupFlag);
  const isMobile = useIsMobile();
  const { compatible, text } = useGroupCompatibility(groupFlag);
  const { privacy } = useGroupPrivacy(groupFlag);
  const form = useForm<GroupFormSchema>({
    defaultValues: {
      ...emptyMeta,
      ...group?.meta,
      privacy,
    },
    mode: 'onChange',
  });
  const { enabled, describe } = useLure(groupFlag);
  const { mutate: editMutation, status: editStatus } = useEditGroupMutation({
    onSuccess: () => {
      form.reset({
        ...form.getValues(),
      });
    },
  });
  const { mutate: swapCordonMutation } = useGroupSwapCordonMutation();
  const { mutate: setSecretMutation } = useGroupSetSecretMutation();

  const onSubmit = useCallback(
    async ({
      privacy: newPrivacy,
      ...values
    }: GroupMeta & { privacy: PrivacyType }) => {
      try {
        editMutation({ flag: groupFlag, metadata: values });

        if (enabled) {
          describe(values);
        }

        const privacyChanged = newPrivacy !== privacy;
        if (privacyChanged) {
          swapCordonMutation({
            flag: groupFlag,
            cordon:
              newPrivacy === 'public'
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
                  },
          });

          setSecretMutation({
            flag: groupFlag,
            isSecret: newPrivacy === 'secret',
          });
        }
        if (privacyChanged) {
          form.reset({
            ...values,
            privacy: newPrivacy,
          });
        }
      } catch (e) {
        console.log("GroupInfoEditor: couldn't edit group", e);
      }
    },
    [
      groupFlag,
      privacy,
      enabled,
      describe,
      editMutation,
      swapCordonMutation,
      setSecretMutation,
      form,
    ]
  );

  return (
    <>
      <Helmet>
        <title>
          {group?.meta ? `Info for ${group.meta.title} ${title}` : title}
        </title>
      </Helmet>
      {isMobile && (
        <MobileHeader
          title="Group Info"
          pathBack={`/groups/${groupFlag}/edit`}
        />
      )}
      <FormProvider {...form}>
        <form
          className="h-full space-y-8 overflow-auto px-6 py-4 pb-16 md:px-4"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <div>
            <h2 className="mb-2 text-lg font-semibold">Group Info</h2>
            <p className="leading-5 text-gray-600">
              Name your group, describe it to people, and give it some
              personality.
            </p>
          </div>
          <GroupInfoFields />
          <footer className="flex items-center justify-end space-x-2">
            <button
              type="button"
              className="secondary-button"
              disabled={!form.formState.isDirty}
              onClick={() => form.reset()}
            >
              Reset
            </button>
            <Tooltip content={text} open={compatible ? false : undefined}>
              <button
                type="submit"
                className="button"
                disabled={!form.formState.isDirty || !compatible}
              >
                {editStatus === 'loading' ? (
                  <LoadingSpinner />
                ) : editStatus === 'error' ? (
                  'Error'
                ) : (
                  'Save'
                )}
              </button>
            </Tooltip>
          </footer>
        </form>
      </FormProvider>
    </>
  );
}
