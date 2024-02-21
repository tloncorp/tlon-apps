import { useMemo } from 'react';

import { IconProps } from './icon';

export default function HomeIconMobileNav({
  className,
  isInactive,
  isDarkMode,
  asIcon,
}: {
  isInactive?: boolean;
  isDarkMode?: boolean;
  asIcon?: boolean;
} & IconProps) {
  const opacity = useMemo(
    () => (asIcon ? '.4' : isDarkMode ? '.8' : '0.2'),
    [isDarkMode, asIcon]
  );
  if (isInactive) {
    return (
      <svg
        viewBox="0 0 21 22"
        fill="none"
        className={className}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M1.125 9.89813C1.125 9.32686 1.3693 8.78285 1.79627 8.40331L8.79627 2.18109C9.55404 1.50752 10.696 1.50752 11.4537 2.18109L18.4537 8.40331C18.8807 8.78285 19.125 9.32686 19.125 9.89813V19.2C19.125 20.1941 18.3191 21 17.325 21H13.125C12.5727 21 12.125 20.5523 12.125 20V17C12.125 15.8954 11.2296 15 10.125 15V15C9.02043 15 8.125 15.8954 8.125 17V20C8.125 20.5523 7.67728 21 7.125 21H2.925C1.93089 21 1.125 20.1941 1.125 19.2V9.89813Z"
          className="stroke-current"
          strokeWidth="1.8"
          opacity={opacity}
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 21 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M1.125 9.89813C1.125 9.32686 1.3693 8.78285 1.79627 8.40331L8.79627 2.18109C9.55404 1.50752 10.696 1.50752 11.4537 2.18109L18.4537 8.40331C18.8807 8.78285 19.125 9.32686 19.125 9.89813V19.2C19.125 20.1941 18.3191 21 17.325 21H13.125C12.5727 21 12.125 20.5523 12.125 20V17C12.125 15.8954 11.2296 15 10.125 15C9.02043 15 8.125 15.8954 8.125 17V20C8.125 20.5523 7.67728 21 7.125 21H2.925C1.93089 21 1.125 20.1941 1.125 19.2V9.89813Z"
        fill="#333333"
        stroke="#333333"
        className="fill-current stroke-current"
        strokeWidth="1.8"
      />
    </svg>
  );
}
