import React from 'react';
import { useLocalStorage } from 'usehooks-ts';
import { createStorageKey } from '@/logic/utils';
import AsteriskIcon from './icons/Asterisk16Icon';

interface ButterBarProps {
  dismissKey: string;
  message: string;
}

function ButterBar({ dismissKey, message }: ButterBarProps) {
  const [isDismissed, setIsDismissed] = useLocalStorage(
    createStorageKey(dismissKey),
    false
  );

  function onClick() {
    setIsDismissed(true);
  }

  return isDismissed ? null : (
    <div className="z-50 flex items-center justify-between bg-yellow py-1 px-2 text-sm font-medium text-black dark:text-white">
      <div className="flex items-center">
        <AsteriskIcon className="mr-3 h-4 w-4" />
        {message}
      </div>
      <button className="py-1 px-2" onClick={onClick}>
        Dismiss
      </button>
    </div>
  );
}

export default ButterBar;
