import React, { PropsWithChildren } from 'react';
import cn from 'classnames';

type LayoutProps = PropsWithChildren<{
  stickyHeader?: boolean;
  className?: string;
  footer?: React.ReactNode;
  header?: React.ReactNode;
  aside?: React.ReactNode;
  mainClass?: string;
}>;

export default function Layout({
  className,
  mainClass,
  children,
  footer,
  header,
  aside,
  stickyHeader = false,
}: LayoutProps) {
  return (
    <div className={cn(className, 'layout', stickyHeader ? 'relative' : '')}>
      {header && (
        <header
          className={cn('header z-40', stickyHeader ? ' sticky top-0' : '')}
        >
          {header}
        </header>
      )}
      {aside && <aside className="aside">{aside}</aside>}
      <main className={cn('main', mainClass)}>{children}</main>
      {footer && <footer className="footer">{footer}</footer>}
    </div>
  );
}
