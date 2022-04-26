import React from 'react';

import './Layout.scss';

interface LayoutProps {
  children: React.ReactNode;
  footer?: React.ReactNode;
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
}

export default function Layout({ children, footer, header, sidebar }: LayoutProps) {
  return (
    <div id="layout">
      <div id="header">{header}</div>
      <div id="sidebar">{sidebar}</div>
      <div id="main">{children}</div>
      <div id="footer">{footer}</div>
    </div>
  );
}
