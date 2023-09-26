import React from 'react';
import GridIcon from '../icons/GridIcon';
import useLeap from '../Leap/useLeap';

export default function SystemChrome() {
  const metaKey = navigator.platform.includes('Mac') ? '⌘ ' : 'Ctrl';
  // const { isOpen, setIsOpen } = useLeap();
  return (
    <button
      // onClick={() => setIsOpen(!isOpen)}
      className="flex w-full cursor-pointer flex-row space-x-2 px-1 text-gray-400 hover:text-gray-800"
    >
      <div className="flex flex-row items-center space-x-2">
        <GridIcon className="h-8 w-8" />
        <span className="font-semibold">Leap</span>
        <span>({metaKey} + K)</span>
      </div>
    </button>
  );
}
