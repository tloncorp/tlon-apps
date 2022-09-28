import React from 'react';
import { useLocalStorage } from 'usehooks-ts';
import AsteriskIcon from './icons/Asterisk16Icon';

interface ButterBarProps {
  dismissKey: string;
  message: string;
}

function ButterBar({ dismissKey, message }: ButterBarProps) {
  const [isDismissed, setIsDismissed] = useLocalStorage(dismissKey, false);

  function onClick() {
    setIsDismissed(true);
  }

  return isDismissed ? null : (
    <div className="flex h-6 items-center justify-between bg-yellow py-1 px-2 text-sm font-medium text-black dark:text-white">
      <div className="flex items-center">
        <AsteriskIcon className="mr-3 h-4 w-4" />
        {message}
      </div>
      <button onClick={onClick}>Dismiss</button>
    </div>
  );
}

export default ButterBar;
