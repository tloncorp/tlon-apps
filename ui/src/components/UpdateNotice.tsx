import React from 'react';
import AsteriskIcon from '@/components/icons/Asterisk16Icon';
import { isTalk } from '@/logic/utils';

export default function UpdateNotice() {
  const appName = isTalk ? 'Talk' : 'Groups';
  function onClick() {
    window.location.reload();
  }

  return (
    <div className="z-50 flex items-center justify-between bg-yellow py-1 px-2 text-sm font-medium text-black dark:text-white">
      <div className="flex items-center">
        <AsteriskIcon className="mr-3 h-4 w-4" />
        <span className="mr-1">
          {appName} has updated in the background. Please reload.
        </span>
      </div>
      <button className="py-1 px-2" onClick={onClick}>
        Reload
      </button>
    </div>
  );
}
