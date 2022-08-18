import React, { PropsWithChildren } from 'react';
import cn from 'classnames';

type LayoutProps = PropsWithChildren<{
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
}: LayoutProps) {
  return (
    <div className={cn(className, 'layout')}>
      {header && <header className="header">{header}</header>}
      {aside && <aside className="aside">{aside}</aside>}
      <main className={cn('main', mainClass)}>{children}</main>
      {footer && <footer className="footer">{footer}</footer>}
    </div>
  );
}
