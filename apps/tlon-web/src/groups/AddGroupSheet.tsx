import cn from 'classnames';
import { useState } from 'react';

import WidgetDrawer from '@/components/WidgetDrawer';
import HomeIconMobileNav from '@/components/icons/HomeIconMobileNav';
import NewRaysIcon from '@/components/icons/NewRaysIcon';
import { isNativeApp } from '@/logic/native';

import { CreateGroupSheetView as CreateGroup } from './AddGroup/CreateGroup';
import JoinGroupSheet from './AddGroup/JoinGroup';

function CreateOrJoin(props: { onCreate: () => void; onJoin: () => void }) {
  return (
    <div className="flex w-full flex-col items-center pb-4">
      <h3 className="mb-6 mt-4 text-[17px] ">Add a group</h3>
      <div className="flex flex-col overflow-hidden rounded-lg border border-gray-100">
        <button
          className="group flex items-center overflow-hidden border-b border-gray-100 px-6 py-4 active:bg-blue-100 dark:active:bg-blue"
          onClick={props.onJoin}
        >
          <HomeIconMobileNav
            className="mr-4 h-6 w-6 group-active:dark:text-black"
            isInactive
            asIcon
          />
          <div className="flex flex-col items-start">
            <h4 className="mb-1.5 text-[17px] tracking-wide group-active:dark:text-black">
              Join a group
            </h4>
            <p className="text-left text-gray-300 group-active:dark:text-black">
              Join with short code or host&#39;s Urbit ID
            </p>
          </div>
        </button>
        <button
          className="group flex items-center overflow-hidden px-6 py-4 text-blue active:bg-blue-100 dark:active:bg-blue"
          onClick={props.onCreate}
        >
          <NewRaysIcon className="mr-4 h-6 w-6 group-active:dark:text-black" />
          <div className="flex flex-col items-start ">
            <h4 className="mb-1.5 text-[17px] tracking-wide group-active:dark:text-black">
              Create new group
            </h4>
            <p className="text-left text-gray-300 group-active:dark:text-black">
              Start a group from scratch
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

export default function AddGroupSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [view, setView] = useState<'root' | 'create' | 'join'>('root');

  const onOpenChange = (open: boolean) => {
    if (!open) {
      setView('root');
    }
    if (props.onOpenChange) {
      props.onOpenChange(open);
    }
  };

  const delayedViewNav = (newView: 'root' | 'create' | 'join') => {
    setTimeout(() => {
      setView(newView);
    }, 100);
  };

  return (
    <WidgetDrawer
      open={props.open}
      onOpenChange={onOpenChange}
      className={cn('px-6', view === 'root' && 'h-[30vh]!')}
      withGrabber={true}
    >
      <div className="mt-4">
        {view === 'root' && (
          <CreateOrJoin
            onCreate={() => delayedViewNav('create')}
            onJoin={() => delayedViewNav('join')}
          />
        )}
        {view === 'create' && <CreateGroup back={() => setView('root')} />}
        {view === 'join' && (
          <JoinGroupSheet
            back={() => setView('root')}
            onOpenChange={onOpenChange}
          />
        )}
      </div>
      {!isNativeApp() && <div className="pb-6" />}
    </WidgetDrawer>
  );
}
