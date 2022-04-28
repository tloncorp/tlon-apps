import React from 'react';

interface LayoutProps {
  main: React.ReactNode;
  footer?: React.ReactNode;
  header?: React.ReactNode;
  aside?: React.ReactNode;
}

export default function Layout({ main, footer, header, aside }: LayoutProps) {
  return (
    <div className="layout">
      {header && <header className="header">{header}</header>}
      {aside && <aside className="aside">{aside}</aside>}
      <main className="main">{main}</main>
      {footer && <footer className="footer">{footer}</footer>}
    </div>
  );
}
