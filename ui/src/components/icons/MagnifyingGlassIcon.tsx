import React from 'react';
import { IconProps } from './icon';

export default function MagnifyingGlassIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
    >
      <path
        className="fill-current"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M18 11c0 2.7614-2.2386 5-5 5s-5-2.2386-5-5c0-2.76142 2.2386-5 5-5s5 2.23858 5 5Zm2 0c0 3.866-3.134 7-7 7-1.5759 0-3.0302-.5208-4.20015-1.3996a1.001357 1.001357 0 0 1-.09274.1067l-4 4c-.39053.3905-1.02369.3905-1.41422 0-.39052-.3905-.39052-1.0237 0-1.4142l4-4c.03385-.0339.06953-.0648.10671-.0928C6.52077 14.0302 6 12.5759 6 11c0-3.86599 3.13401-7 7-7 3.866 0 7 3.13401 7 7Z"
      />
    </svg>
  );
}
