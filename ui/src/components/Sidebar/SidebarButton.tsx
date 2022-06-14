import cn from 'classnames';
import React from 'react';

interface SidebarProps extends React.ComponentPropsWithoutRef<'button'> {
  actions?: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

export default function SidebarButton({
  actions,
  children,
  className,
  icon,
  ...rest
}: SidebarProps) {
  return (
    <button
      className={cn(
        'default-focus flex w-full items-center justify-between space-x-3 rounded-lg p-2 text-base font-semibold text-gray-600 hover:bg-gray-50',
        className
      )}
      {...rest}
    >
      <div className="flex items-center">
        {icon ? (
          icon
        ) : (
          <div className="h-6 w-6 rounded border-2 border-gray-100" />
        )}
        {typeof children === 'string' ? (
          <div
            title={children}
            className="text-light-gray-600 mx-3 max-w-[128px] overflow-hidden text-ellipsis whitespace-nowrap"
          >
            {children}
          </div>
        ) : (
          children
        )}
      </div>
      <div>{actions}</div>
    </button>
  );
}
