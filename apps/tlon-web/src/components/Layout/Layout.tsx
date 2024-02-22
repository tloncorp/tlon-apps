import cn from 'classnames';
import React, { PropsWithChildren } from 'react';

type LayoutProps = PropsWithChildren<{
  stickyHeader?: boolean;
  className?: string;
  footer?: React.ReactNode;
  header?: React.ReactNode;
  aside?: React.ReactNode;
  mainClass?: string;
  style?: React.CSSProperties;
}>;

export default function Layout({
  className,
  mainClass,
  children,
  footer,
  header,
  aside,
  stickyHeader = false,
  style,
}: LayoutProps) {
  return (
    <div
      style={style}
      className={cn(className, 'layout', stickyHeader ? 'relative' : '')}
    >
      {header && (
        <header
          className={cn('header z-40', stickyHeader ? ' sticky top-0' : '')}
        >
          {header}
        </header>
      )}
      {aside && <aside className="aside">{aside}</aside>}
      <main className={cn('main relative', mainClass)}>{children}</main>
      {footer && <footer className="footer">{footer}</footer>}
    </div>
  );
}
