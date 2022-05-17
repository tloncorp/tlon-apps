import React from 'react';
import { NavLink, NavLinkProps, useLocation } from 'react-router-dom';

export default function RetainedStateLink({
  children,
  ...props
}: NavLinkProps) {
  const location = useLocation();
  return (
    <NavLink {...props} state={location.state}>
      {children}
    </NavLink>
  );
}
