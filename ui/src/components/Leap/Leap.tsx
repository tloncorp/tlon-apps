import React, { useRef } from 'react';
import { useEventListener } from 'usehooks-ts';
import Dialog, { DialogContent } from '../Dialog';
import LeapRow from './LeapRow';
import LeapSectionRow from './LeapSectionRow';
import useLeap from './useLeap';

export default function Leap() {
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
  });

  // dialog actions
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEventListener(
    'keydown',
    (event) => {
      if (!(document.activeElement === inputRef.current)) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (selectedIndex < resultCount - 1) {
          setSelectedIndex((idx) => idx + 1);
        } else {
          setSelectedIndex((_idx) => 0);
        }
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (selectedIndex > 0) {
          setSelectedIndex((idx) => idx - 1);
        } else {
          setSelectedIndex((_idx) => resultCount - 1);
        }
      } else if (event.key === 'Enter') {
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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        className="fixed top-1/4 w-full"
        containerClass="w-full sm:max-w-lg top-[10%]"
        showClose={false}
      >
        <div className="flex items-center justify-between">
          <input
            ref={inputRef}
            type="text"
            className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-600"
            placeholder="Search"
            onChange={onChange}
          />
        </div>
        <div className="mt-4">
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
            <div className="flex h-32 w-full items-center justify-center border border-dashed border-gray-200">
              <p className="text-sm text-gray-200">No results</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
