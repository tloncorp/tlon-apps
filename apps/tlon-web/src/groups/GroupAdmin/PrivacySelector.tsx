import {
  GroupFormSchema,
  GroupMeta,
  PrivacyType,
} from '@tloncorp/shared/dist/urbit/groups';
import cn from 'classnames';
import React, { useCallback } from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';

import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import Tooltip from '@/components/Tooltip';
import GlobeIcon from '@/components/icons/GlobeIcon';
import LockIcon from '@/components/icons/LockIcon';
import PrivateIcon from '@/components/icons/PrivateIcon';
import useGroupPrivacy from '@/logic/useGroupPrivacy';
import {
  useEditGroupMutation,
  useGroup,
  useGroupCompatibility,
  useGroupSetSecretMutation,
  useGroupSwapCordonMutation,
  useRouteGroup,
} from '@/state/groups';
import { useLure } from '@/state/lure/lure';

interface PrivacySetting {
  title: string;
  icon: React.ReactElement;
  description: Array<string>;
}

const PRIVACY_TYPE: Record<PrivacyType, PrivacySetting> = {
  public: {
    icon: <GlobeIcon className="h-6 w-6" />,
    title: 'Public',
    description: [
      'Anyone can find and join this group',
      'Appears in search/recommendations',
      'Group posts can be linked to and viewed outside of group',
    ],
  },
  private: {
    icon: <LockIcon className="h-6 w-6" />,
    title: 'Private',
    description: [
      'Anyone can find and request to join group',
      'Appears in search/recommendations',
      'Group posts can be linked to and viewed outside of group',
    ],
  },
  secret: {
    icon: <PrivateIcon className="h-6 w-6" />,
    title: 'Secret',
    description: [
      'Group is undetectable and invite-only',
      'Not present in search/recommendations',
      'Group posts cannot be linked to or viewed outside of group',
    ],
  },
};

interface PrivacySettingRowProps {
  type: PrivacyType;
  horizontal?: boolean;
}

function PrivacySettingRow({
  type,
  horizontal = false,
}: PrivacySettingRowProps) {
  const { title, description, icon } = PRIVACY_TYPE[type];
  const { register, watch } = useFormContext<GroupFormSchema>();
  const selected = type === watch('privacy');

  return (
    <label
      className={cn(
        'flex cursor-pointer flex-col justify-between rounded-lg p-4',
        selected ? 'bg-blue-soft' : 'bg-white',
        horizontal ? 'space-y-2 sm:items-center' : ''
      )}
    >
      <div
        className={cn(
          'flex items-center',
          horizontal
            ? 'space-x-2 sm:flex-col sm:space-x-0 sm:space-y-2'
            : 'mb-2 flex-row space-x-2'
        )}
      >
        <div className={cn(selected ? 'text-blue' : 'text-gray-600')}>
          {icon}
        </div>

        <h3
          className={cn(
            'text-lg font-semibold',
            selected ? 'text-blue' : 'text-gray-600'
          )}
        >
          {title}
        </h3>
      </div>

      <ul
        className={cn(
          'list-outside list-disc pl-8 text-sm leading-4 tracking-tight text-gray-600 mix-blend-multiply  dark:mix-blend-screen md:text-base md:leading-5',
          horizontal ? 'sm:pl-0' : ''
        )}
      >
        {description.map((desc) => (
          <li className="ml-4 sm:mb-1.5">{desc}</li>
        ))}
      </ul>

      <input
        {...register('privacy')}
        className="sr-only"
        type="radio"
        value={type}
      />
    </label>
  );
}

type PrivacySelectorProps = {
  horizontal?: boolean;
};

export function PrivacySelector({ horizontal = false }: PrivacySelectorProps) {
  return (
    <ul
      className={cn('flex', horizontal ? 'flex-col sm:flex-row' : 'flex-col')}
    >
      {Object.keys(PRIVACY_TYPE).map((privType) => (
        <li className={cn(horizontal ? 'sm:w-1/3' : 'w-full')} key={privType}>
          <PrivacySettingRow
            type={privType as PrivacyType}
            horizontal={horizontal}
          />
        </li>
      ))}
    </ul>
  );
}

export function PrivacySelectorForm() {
  const groupFlag = useRouteGroup();
  const { privacy } = useGroupPrivacy(groupFlag);
  const { compatible, text } = useGroupCompatibility(groupFlag);
  const form = useForm<GroupFormSchema>({
    defaultValues: {
      privacy,
    },
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
      // editMutation,
      swapCordonMutation,
      setSecretMutation,
      form,
    ]
  );

  return (
    <FormProvider {...form}>
      <form
        className="flex flex-col space-y-4"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <PrivacySelector />
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
  );
}
