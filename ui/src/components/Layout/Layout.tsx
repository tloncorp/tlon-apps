import React, { PropsWithChildren } from 'react';
import cn from 'classnames';

type LayoutProps = PropsWithChildren<{
  className?: string;
  footer?: React.ReactNode;
  header?: React.ReactNode;
  aside?: React.ReactNode;
}>;

export default function Layout({
  className,
  children,
  footer,
  header,
  aside,
}: LayoutProps) {
  return (
    <div className={cn(className, 'layout')}>
      {header && <header className="header">{header}</header>}
      {aside && <aside className="aside">{aside}</aside>}
      <main className="main">{children}</main>
      {footer && <footer className="footer">{footer}</footer>}
    </div>
  );
}
