import cn from 'classnames';
import React, { PropsWithChildren } from 'react';

type DividerProps = PropsWithChildren<{
  className?: string;
}>;

export default function Divider({ className, children }: DividerProps) {
  return (
    <div className={cn('flex items-center space-x-2 p-2', className)}>
      <span className="text-sm font-semibold text-gray-400">{children}</span>
      <div className="grow border-b-2 border-gray-50" />
    </div>
  );
}
