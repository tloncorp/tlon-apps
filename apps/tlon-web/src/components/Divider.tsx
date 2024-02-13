import cn from 'classnames';
import React, { PropsWithChildren } from 'react';

type DividerProps = PropsWithChildren<{
  className?: string;
  isMobile?: boolean;
}>;

export default function Divider({
  className,
  isMobile,
  children,
}: DividerProps) {
  if (isMobile) {
    return <h2 className="mb-0.5 p-2 font-sans text-gray-400">{children}</h2>;
  }

  return (
    <div className={cn('mt-3 flex items-center space-x-2 p-2', className)}>
      <span className="text-sm font-semibold text-gray-400">{children}</span>
    </div>
  );
}
