import { useCallback, useState } from 'react';
import cn from 'classnames';
import WidgetDrawer from '@/components/WidgetDrawer';
import HomeIconMobileNav from '@/components/icons/HomeIconMobileNav';
import NewRaysIcon from '@/components/icons/NewRaysIcon';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import { strToSym } from '@/logic/utils';
import { useCreateGroupMutation } from '@/state/groups';
import { useNavigate } from 'react-router-dom';
import { isNativeApp } from '@/logic/native';

function DragHandle() {
  return (
    <div className="my-3 flex w-full justify-center">
      <div className="h-[5px] w-[32px] rounded-[100px] bg-gray-100" />
    </div>
  );
}

function CreateGroup(props: { back: () => void }) {
  const { mutateAsync: createGroupMutation, isLoading } =
    useCreateGroupMutation();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const shortCode = strToSym(input).replace(/[^a-z]*([a-z][-\w\d]+)/i, '$1');

  const createGroup = useCallback(async () => {
    if (!input || !shortCode) return;

    try {
      await createGroupMutation({
        title: input,
        description: '',
        image: '',
        cover: '',
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
      navigate(`/groups/${flag}`);
    } catch (error) {
      console.log("Couldn't create group", error);
    }
  }, [createGroupMutation, input, shortCode, navigate]);

  return (
    <div className="flex w-full flex-col items-center">
      <div className="mb-4 flex w-full items-center justify-between px-2">
        <div
          className="flex h-6 w-6 items-center justify-center"
          onClick={() => props.back()}
        >
          <CaretLeft16Icon className="h-6 w-6" />
        </div>
        <h3 className="text-[17px]">New Group</h3>
        <div className="invisible h-6 w-6" />
      </div>
      <div className="flex w-full flex-col pt-6">
        <label className="text-small pb-3 text-gray-400">
          Name your group, you can edit it later
        </label>
        <input
          className="w-full rounded-lg border border-gray-100 px-4 py-3.5 text-lg outline-none"
          autoFocus
          placeholder="Group name"
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
      <button
        className="mt-6 w-full rounded-lg border border-blue-200 bg-blue-soft px-6 py-4 text-lg font-semibold text-blue disabled:border-gray-100 disabled:bg-gray-50 disabled:text-gray-400"
        disabled={input === ''}
        onClick={createGroup}
      >
        Create Group
      </button>
    </div>
  );
}

export default function AddGroupSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [view, setView] = useState<'root' | 'create' | 'join'>('root');
  const height = view === 'root' ? 'h-30vh' : 'h-60vh';

  const onOpenChange = (open: boolean) => {
    if (!open) {
      setView('root');
    }
    props.onOpenChange(open);
  };

  const CreateOrJoin = useCallback(() => {
    return (
      <div className="flex w-full flex-col items-center">
        <h3 className="mt-4 mb-6 text-[17px] ">Add a group</h3>
        <div className="flex flex-col rounded-lg border border-gray-100">
          <button
            className="flex items-center border-b border-gray-100 px-6 py-4"
            onClick={() => setView('join')}
          >
            <HomeIconMobileNav className="mr-4 h-6 w-6" isInactive asIcon />
            <div className="flex flex-col items-start">
              <h4 className="mb-1.5 text-[17px] tracking-wide">Join a group</h4>
              <p className="text-gray-300">
                Join with short code or host's Urbit ID
              </p>
            </div>
          </button>
          <button
            className="flex items-center px-6 py-4 text-blue"
            onClick={() => setView('create')}
          >
            <NewRaysIcon className="mr-4 h-6 w-6" />
            <div className="flex flex-col items-start">
              <h4 className="mb-1.5 text-[17px] tracking-wide">
                Create new group
              </h4>
              <p className="text-gray-300">Start a group from scratch</p>
            </div>
          </button>
        </div>
      </div>
    );
  }, []);

  return (
    <WidgetDrawer
      open={props.open}
      onOpenChange={onOpenChange}
      className={cn('px-6', height)}
    >
      <DragHandle />
      <div className="mt-4">
        {view === 'root' && <CreateOrJoin />}
        {view === 'create' && <CreateGroup back={() => setView('root')} />}
      </div>
      {!isNativeApp() && <div className="pb-6" />}
    </WidgetDrawer>
  );
}
