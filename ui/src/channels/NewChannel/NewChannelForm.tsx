import React from 'react';
import cn from 'classnames';
import { useFormContext } from 'react-hook-form';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChannelVisibility } from '@/types/groups';
import LockOpenIcon from '@/components/icons/LockOpenIcon';
import LockIcon from '@/components/icons/LockIcon';
import CheckIcon from '@/components/icons/CheckIcon';
import ChannelTypeSelector from '../ChannelTypeSelector';

interface NewChannelFormProps {
  edit?: boolean;
  goToNextStep: () => void;
  channelVisibility: ChannelVisibility;
  setChannelVisibility: React.Dispatch<React.SetStateAction<ChannelVisibility>>;
}

export default function NewChannelForm({
  edit,
  goToNextStep,
  channelVisibility,
  setChannelVisibility,
}: NewChannelFormProps) {
  const { register, formState } = useFormContext();

  return (
    <>
      <div className="sm:w-96">
        <header className="mb-6 flex items-center">
          <h2 className="text-lg font-bold">
            {edit ? 'Edit Channel' : 'Add New Channel'}
          </h2>
        </header>
      </div>
      <div className="flex flex-col">
        {!edit ? (
          <>
            <ChannelTypeSelector className="mb-6" />
            <div className="mb-6 flex w-full justify-end">
              <button className="button" disabled>
                Search for New Channel Types – Coming Soon!
              </button>
            </div>
          </>
        ) : null}
        <label className="mb-6 font-semibold">
          Channel Name*
          <input
            {...register('meta.title', { required: true })}
            className="input my-2 block w-full p-1"
            type="text"
          />
        </label>
        <div>
          <label className="mb-6 font-semibold">
            Channel Visibility
            <ul className="mt-2 flex flex-col space-y-2">
              <li>
                <label
                  className={cn(
                    'flex cursor-pointer items-center justify-between rounded-lg p-2',
                    channelVisibility === 'open' ? 'bg-gray-50' : 'bg-white'
                  )}
                >
                  <div className="flex w-full flex-col">
                    <div className="flex flex-row items-center space-x-2">
                      <div
                        className={cn(
                          'rounded bg-gray-50 p-2 mix-blend-multiply dark:mix-blend-screen'
                        )}
                      >
                        <LockOpenIcon className="h-6 w-6 text-gray-600" />
                      </div>
                      <div className="flex w-full flex-col justify-start text-left">
                        <span className="font-semibold">Open</span>
                        <span className="text-sm font-medium text-gray-600">
                          By default, all group members can view and contribute
                        </span>
                      </div>
                    </div>
                  </div>
                  {channelVisibility === 'open' ? (
                    <CheckIcon className="h-6 w-6 text-gray-600" />
                  ) : null}
                  <input
                    onClick={() => setChannelVisibility('open')}
                    className="sr-only"
                    type="radio"
                    value="open"
                  />
                </label>
              </li>
              <li>
                <label
                  className={cn(
                    'flex cursor-pointer items-center justify-between rounded-lg p-2',
                    channelVisibility === 'closed' ? 'bg-gray-50' : 'bg-white'
                  )}
                >
                  <div className="flex w-full flex-col">
                    <div className="flex flex-row items-center space-x-2">
                      <div
                        className={cn(
                          'rounded bg-gray-50 p-2 mix-blend-multiply dark:mix-blend-screen'
                        )}
                      >
                        <LockIcon className="h-6 w-6 text-gray-600" />
                      </div>
                      <div className="flex w-full flex-col justify-start text-left">
                        <span className="font-semibold">Closed</span>
                        <span className="text-sm font-medium text-gray-600">
                          By default, group members cannot view/contribute
                        </span>
                      </div>
                    </div>
                  </div>
                  {channelVisibility === 'closed' ? (
                    <CheckIcon className="h-6 w-6 text-gray-600" />
                  ) : null}
                  <input
                    onClick={() => setChannelVisibility('closed')}
                    className="sr-only"
                    type="radio"
                    value="closed"
                  />
                </label>
              </li>
            </ul>
          </label>
        </div>

        <footer className="mt-4 flex items-center justify-between space-x-2">
          <div className="ml-auto flex items-center space-x-2">
            <DialogPrimitive.Close asChild>
              <button className="secondary-button ml-auto">Cancel</button>
            </DialogPrimitive.Close>
            <button
              className="button"
              disabled={!formState.isValid}
              onClick={goToNextStep}
            >
              Next: Channel Details
            </button>
          </div>
        </footer>
      </div>
    </>
  );
}
