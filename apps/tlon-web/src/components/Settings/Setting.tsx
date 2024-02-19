import cn from 'classnames';
import React, { HTMLAttributes } from 'react';
import slugify from 'slugify';

import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import Toggle from '@/components/Toggle';

type SettingProps = {
  name: string;
  on: boolean;
  disabled?: boolean;
  toggle: (open: boolean) => void;
  status: 'loading' | 'error' | 'success' | 'idle';
  labelClassName?: string;
  dataTestid?: string;
} & HTMLAttributes<HTMLDivElement>;

export default function Setting({
  name,
  on,
  disabled = false,
  className,
  children,
  labelClassName,
  toggle,
  status,
  dataTestid,
}: SettingProps) {
  const id = slugify(name);

  return (
    <section className={className} data-testid={dataTestid || undefined}>
      <div className="flex space-x-2">
        <Toggle
          aria-labelledby={id}
          pressed={on}
          onPressedChange={toggle}
          className="flex-none self-start text-blue-400"
          disabled={disabled}
          loading={status === 'loading'}
        />
        <div className="flex flex-1 flex-col justify-center">
          <h3
            id={id}
            className={cn('flex items-center leading-6', labelClassName)}
          >
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
