import React from 'react';
import cn from 'classnames';
import { capitalize } from 'lodash';
import { useFormContext } from 'react-hook-form';
import ChannelPermsSelector from '@/groups/GroupAdmin/AdminChannels/ChannelPermsSelector';
import { ChannelType, ChannelVisibility } from '@/types/groups';
import { useCalm } from '@/state/settings';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import Lock16Icon from '@/components/icons/Lock16Icon';
import LockOpen16Icon from '@/components/icons/LockOpen16Icon';

interface NewChannelDetailsProps {
  channelType: ChannelType;
  visibility: ChannelVisibility;
  goToNextStep: () => void;
  goToPrevStep: () => void;
}

export default function NewChannelDetails({
  goToNextStep,
  goToPrevStep,
  visibility,
  channelType,
}: NewChannelDetailsProps) {
  const { register, formState, watch } = useFormContext();
  const calm = useCalm();
  const watchTitle = watch('meta.title');
  const channelTypeName =
    channelType === 'chat'
      ? 'Chat'
      : channelType === 'heap'
      ? 'Gallery'
      : 'Notebook';

  return (
    <div>
      <div className="sm:w-96">
        <header className="mb-6 flex items-center">
          <h2 className="text-lg font-bold">Customize: {watchTitle}</h2>
        </header>
      </div>
      <div className="flex flex-col space-y-6">
        <label className="font-semibold">
          {channelTypeName} Description
          <textarea
            // TODO: set sane maxLength
            {...register('meta.description', { maxLength: 300 })}
            className="input mt-2 w-full"
            spellCheck={`${!calm.disableSpellcheck}`}
            placeholder={`Describe your ${channelTypeName.toLowerCase()} with a sentence or two`}
          />
        </label>
        <label className="mb-3 flex flex-col space-y-2 font-semibold">
          <div className="flex w-full items-center justify-between">
            Permissions
            <div
              className={cn(
                'flex items-center space-x-1 rounded p-1 text-sm',
                visibility === 'closed'
                  ? 'bg-indigo-soft text-indigo'
                  : 'bg-green-soft text-green'
              )}
            >
              {visibility === 'closed' ? (
                <Lock16Icon className="h-4 w-4 text-indigo" />
              ) : (
                <LockOpen16Icon className="h-4 w-4 text-green" />
              )}
              <div>{capitalize(visibility)} Channel</div>
            </div>
          </div>
          <ChannelPermsSelector visibility={visibility} />
        </label>
        {/* <ChannelJoinSelector /> */}
        <footer className="flex items-center justify-between space-y-2">
          <div className="ml-auto flex items-center space-x-2">
            <button className="secondary-button ml-auto" onClick={goToPrevStep}>
              Back
            </button>
            <button
              type="submit"
              className="button"
              disabled={
                !formState.isValid ||
                !formState.isDirty ||
                formState.isSubmitting
              }
              onClick={() => goToNextStep()}
            >
              {formState.isSubmitting ? (
                <LoadingSpinner className="h-4 w-4" />
              ) : (
                `Create ${channelTypeName}`
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
