import React, { useRef } from 'react';
import { useEventListener } from 'usehooks-ts';

import keyMap from '@/keyMap';

import Dialog from '../Dialog';
import MobileHeader from '../MobileHeader';
import MagnifyingGlassIcon from '../icons/MagnifyingGlassIcon';
import LeapRow from './LeapRow';
import LeapSectionRow from './LeapSectionRow';
import useLeap from './useLeap';

export default function Leap({
  openDefault = false,
}: {
  openDefault?: boolean;
}) {
  const {
    isOpen,
    setIsOpen,
    setInputValue,
    selectedIndex,
    setSelectedIndex,
    results,
    resultCount,
  } = useLeap();

  // open dialog
  useEventListener('keydown', (event) => {
    // Ctrl for Linux and Windows, Cmd for Mac
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      setSelectedIndex(0);
      setInputValue('');
      setIsOpen((state) => !state);
    }
    if (event.key === keyMap.leap.close) {
      event.preventDefault();
      setIsOpen(false);
    }
  });

  // dialog actions
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEventListener(
    'keydown',
    (event) => {
      if (!(document.activeElement === inputRef.current)) {
        return;
      }

      if (event.key === keyMap.leap.nextResult) {
        event.preventDefault();
        if (selectedIndex < resultCount - 1) {
          setSelectedIndex((idx) => idx + 1);
        } else {
          setSelectedIndex((_idx) => 0);
        }
      } else if (event.key === keyMap.leap.prevResult) {
        event.preventDefault();
        if (selectedIndex > 0) {
          setSelectedIndex((idx) => idx - 1);
        } else {
          setSelectedIndex((_idx) => resultCount - 1);
        }
      } else if (event.key === keyMap.leap.selectResult) {
        const result = results
          .filter((r) => 'resultIndex' in r)
          // @ts-expect-error items without resultIndex are filtered out
          .find((r) => r.resultIndex === selectedIndex);
        if (result) {
          // @ts-expect-error items without onSelect are filtered out
          result.onSelect();
        }
      }
    },
    inputRef
  );

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedIndex(0);
    setInputValue(event.target.value);
  };

  return openDefault ? (
    <div className="flex h-full flex-col">
      <MobileHeader title="Leap" />
      <div className="h-full bg-gray-50 p-4">
        <div className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white text-base">
          <MagnifyingGlassIcon className="absolute left-7 h-6 w-6 text-gray-600" />
          <input
            ref={inputRef}
            type="text"
            className="w-full border-collapse rounded-lg border-0 bg-transparent px-4 py-3 pl-11 text-base font-semibold text-gray-800 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-400"
            placeholder="Search"
            onChange={onChange}
          />
        </div>
        <div className="mt-2 overflow-hidden rounded-lg bg-white">
          {results.length > 0 ? (
            results.map((result, idx) =>
              'section' in result ? (
                <LeapSectionRow key={idx} section={result} />
              ) : (
                <LeapRow
                  key={idx}
                  option={result}
                  selected={selectedIndex === result.resultIndex}
                />
              )
            )
          ) : (
            <div className="flex h-24 w-full items-center justify-center border-dashed border-gray-200">
              <p className="text-md font-semibold text-gray-400">No results</p>
            </div>
          )}
        </div>
      </div>
    </div>
  ) : (
    <Dialog
      open={isOpen}
      onOpenChange={setIsOpen}
      className="max-h-full w-full overflow-y-auto bg-transparent p-2"
      containerClass="w-full h-full sm:max-w-lg overflow-visible sm:pt-[10%] p-2"
      close="none"
    >
      <div className="relative flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white text-base">
        <MagnifyingGlassIcon className="absolute left-3 h-6 w-6 text-gray-600" />
        <input
          ref={inputRef}
          type="text"
          className="w-full border-collapse rounded-lg border-0 bg-transparent px-4 py-3 pl-11 text-base font-semibold text-gray-800 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-400"
          placeholder="Search"
          onChange={onChange}
        />
      </div>
      <div className="mt-2 overflow-hidden rounded-lg bg-white">
        {results.length > 0 ? (
          results.map((result, idx) =>
            'section' in result ? (
              <LeapSectionRow key={idx} section={result} />
            ) : (
              <LeapRow
                key={idx}
                option={result}
                selected={selectedIndex === result.resultIndex}
              />
            )
          )
        ) : (
          <div className="flex h-24 w-full items-center justify-center border-dashed border-gray-200">
            <p className="text-md font-semibold text-gray-400">No results</p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
