import cn from 'classnames';
import React from 'react';

interface SidebarProps extends React.ComponentPropsWithoutRef<'button'> {
  className?: string;
  icon?: React.ReactNode;
}

export default function SidebarButton({
  children,
  className,
  icon,
  ...rest
}: SidebarProps) {
  return (
      <button
        className={cn(
          'default-focus flex w-full items-center space-x-3 rounded-lg p-2 text-base font-semibold text-gray-600 hover:bg-gray-50',
          className
        )}
        {...rest}
      >
        {icon ? (
          icon
        ) : (
          <div className="h-6 w-6 rounded border-2 border-gray-100" />
        )}
        {typeof children === 'string' ? <h3>{children}</h3> : children}
      </button>
  );
}
