import { ChangeEvent, useRef } from 'react';

import MagnifyingGlassIcon from '@/components/icons/MagnifyingGlassIcon';
import X16Icon from '@/components/icons/X16Icon';

interface SearchBarProps {
  value: string;
  setValue: (newValue: string) => void;
  placeholder: string;
  isSmall: boolean;
}

function SearchBar({ value, setValue, placeholder, isSmall }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  const onClear = () => {
    inputRef.current?.focus();
    setValue('');
  };

  return (
    <div className="w-full">
      <label className="relative flex w-full items-center">
        <span className="sr-only">Search</span>
        <span className="absolute left-0 pl-2">
          <MagnifyingGlassIcon className="h-6 w-6 text-gray-400" />
        </span>
        <input
          id="search"
          ref={inputRef}
          type="text"
          autoFocus
          className="input w-full bg-gray-50 py-2 pl-8 pr-8 mix-blend-multiply placeholder:font-normal dark:mix-blend-normal md:text-base"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
        />
        {isSmall && value !== '' ? (
          <button
            className="absolute right-3 flex h-4 w-4 items-center justify-center rounded-full bg-gray-500"
            onClick={onClear}
          >
            <X16Icon className="h-3 w-3 text-gray-50" />
          </button>
        ) : null}
      </label>
    </div>
  );
}

export default SearchBar;
