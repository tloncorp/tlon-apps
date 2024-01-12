import { useCallback, useState } from 'react';
import { strToSym } from '@/logic/utils';
import { useCreateGroupMutation } from '@/state/groups';
import { useNavigate } from 'react-router-dom';
import { useCreateMutation } from '@/state/channel/channel';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import LargeTextInput from '@/components/FullsizeTextInput';
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';

export default function CreateGroup(props: { back: () => void }) {
  const { mutateAsync: createGroupMutation, isLoading } =
    useCreateGroupMutation();
  const { mutateAsync: createChannelMutation, isLoading: channelIsLoading } =
    useCreateMutation();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const shortCode = strToSym(input).replace(/[^a-z]*([a-z][-\w\d]+)/i, '$1');

  const createGroup = useCallback(async () => {
    if (!input || !shortCode) return;

    try {
      await createGroupMutation({
        title: input,
        description: '',
        image: '#999999',
        cover: '#D9D9D9',
        name: shortCode,
        members: {},
        cordon: {
          open: {
            ships: [],
            ranks: [],
          },
        },
        secret: false,
      });

      const flag = `${window.our}/${shortCode}`;
      const randomNumber = Math.floor(Math.random() * 10000);

      await createChannelMutation({
        kind: 'chat',
        group: flag,
        name: `welcome-${randomNumber}`,
        title: 'Welcome',
        description: 'Welcome to your new group!',
        readers: [],
        writers: [],
      });

      navigate(`/groups/${flag}`);
    } catch (error) {
      console.log("Couldn't create group", error);
    }
  }, [createGroupMutation, input, shortCode, navigate, createChannelMutation]);

  return (
    <div className="flex w-full flex-col items-center">
      <div className="mb-4 flex w-full items-center justify-between">
        <div
          className="flex h-6 w-6 items-center justify-center"
          onClick={() => props.back()}
        >
          <CaretLeftIcon className="relative right-1 h-6 w-6" />
        </div>
        <h3 className="text-[17px]">New Group</h3>
        <div className="invisible h-6 w-6" />
      </div>

      <div className="flex w-full flex-col pt-6">
        <label className="text-small pb-3 text-gray-400">
          Name your group, you can edit it later
        </label>
        <LargeTextInput
          placeholder="Group name"
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <p className="text-small pt-4 text-gray-400">
          Your <span className="text-black">public</span> group will live at:
          <br />
          {window.ship || '~latter-bolden'}/group/
          <span className="text-black">
            {input !== '' ? shortCode : 'group-name'}
          </span>
        </p>
        <p className="text-small pt-6 text-gray-400">
          {' '}
          You can edit your group's privacy later.{' '}
        </p>
      </div>

      <div className="flex w-full flex-grow items-center justify-center">
        <button
          className="mt-6 w-full rounded-lg border border-blue-200 bg-blue-soft px-6 py-4 text-lg font-semibold text-blue disabled:border-gray-100 disabled:bg-gray-50 disabled:text-gray-400 dark:border-blue-500 dark:disabled:border-gray-100"
          disabled={input === '' || isLoading || channelIsLoading}
          onClick={createGroup}
        >
          {isLoading || channelIsLoading ? (
            <span className="flex w-full items-center justify-center">
              <LoadingSpinner className="h-5 w-5" />
            </span>
          ) : (
            'Create Group'
          )}
        </button>
      </div>
    </div>
  );
}
