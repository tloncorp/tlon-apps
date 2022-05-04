import React from 'react';
import cn from 'classnames';

interface LayoutProps {
  className?: string;
  main: React.ReactNode;
  footer?: React.ReactNode;
  header?: React.ReactNode;
  aside?: React.ReactNode;
}

export default function Layout({
  className,
  main,
  footer,
  header,
  aside,
}: LayoutProps) {
  return (
    <div className={cn(className, 'layout')}>
      {header && <header className="header">{header}</header>}
      {aside && <aside className="aside">{aside}</aside>}
      <main className="main">{main}</main>
      {footer && <footer className="footer">{footer}</footer>}
    </div>
  );
}
