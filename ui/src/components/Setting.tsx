import React, { HTMLAttributes } from 'react';
import slugify from 'slugify';
import useAsyncCall from '@/logic/useAsyncCall';
import LoadingSpinner from './LoadingSpinner/LoadingSpinner';
import Toggle from './Toggle';

type SettingProps = {
  name: string;
  on: boolean;
  disabled?: boolean;
  toggle: (open: boolean) => Promise<void>;
} & HTMLAttributes<HTMLDivElement>;

export default function Setting({
  name,
  on,
  disabled = false,
  toggle,
  className,
  children,
}: SettingProps) {
  const { status, call } = useAsyncCall(toggle);
  const id = slugify(name);

  return (
    <section className={className}>
      <div className="flex space-x-2">
        <Toggle
          aria-labelledby={id}
          pressed={on}
          onPressedChange={call}
          className="flex-none self-start text-blue-400"
          disabled={disabled}
          loading={status === 'loading'}
        />
        <div className="flex flex-1 flex-col justify-center">
          <h3 id={id} className="flex items-center font-semibold leading-6">
            {name}{' '}
            {status === 'loading' && (
              <LoadingSpinner className="ml-2 h-4 w-4" />
            )}
          </h3>
          {children}
        </div>
      </div>
    </section>
  );
}
