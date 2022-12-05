import { debounce } from 'lodash';
import React from 'react';
import { useEventListener } from 'usehooks-ts';
import { useNavigate } from 'react-router';
import { LEAP_SEARCH_DEBOUNCE } from '@/constants';
import Dialog, { DialogContent } from '../Dialog';
import menuOptions from './MenuOptions';
import LeapOption from './LeapOption';
import LeapRow from './LeapRow';

export default function Leap() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const navigate = useNavigate();

  const results = menuOptions.map(
    (o) =>
      new LeapOption({
        ...o,
        onSelect: () => {
          navigate(o.to);
          setIsOpen(false);
        },
      })
  );

  useEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === '/') {
      // TODO: make this configurable
      setIsOpen(true);
    } else if (event.key === 'ArrowDown') {
      if (selectedIndex < results.length - 1) {
        setSelectedIndex((idx) => idx + 1);
      }
    } else if (event.key === 'ArrowUp') {
      if (selectedIndex > 0) {
        setSelectedIndex((idx) => idx - 1);
      }
    } else if (event.key === 'Enter') {
      results[selectedIndex].onSelect();
    }
  });

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };
  const debouncedOnChange = debounce(onChange, LEAP_SEARCH_DEBOUNCE);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent containerClass="w-full sm:max-w-lg" showClose={false}>
        <div className="flex items-center justify-between">
          <input
            type="text"
            className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-600"
            placeholder="Search"
            onChange={debouncedOnChange}
          />
        </div>
        <div className="mt-4">
          {results.map((option, idx) => (
            <LeapRow
              key={idx}
              option={option}
              selected={selectedIndex === idx}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
