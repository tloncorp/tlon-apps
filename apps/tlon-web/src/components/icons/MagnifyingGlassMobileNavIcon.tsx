import cn from 'classnames';

import { IconProps } from './icon';

export default function MagnifyingGlassMobileNavIcon({
  className,
  isInactive,
  isDarkMode,
}: { isInactive?: boolean; isDarkMode?: boolean } & IconProps) {
  if (isInactive) {
    return (
      <svg
        viewBox="0 0 21 21"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(className, 'pb-1')}
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M18.6 8.75C18.6 12.2018 15.8018 15 12.35 15C8.89823 15 6.10001 12.2018 6.10001 8.75C6.10001 5.29822 8.89823 2.5 12.35 2.5C15.8018 2.5 18.6 5.29822 18.6 8.75ZM20.6 8.75C20.6 13.3063 16.9064 17 12.35 17C10.4322 17 8.66726 16.3456 7.26624 15.248L1.80711 20.7071C1.41659 21.0976 0.783424 21.0976 0.392899 20.7071C0.00237502 20.3166 0.00237502 19.6834 0.392899 19.2929L5.85203 13.8338C4.75438 12.4327 4.10001 10.6678 4.10001 8.75C4.10001 4.19365 7.79366 0.5 12.35 0.5C16.9064 0.5 20.6 4.19365 20.6 8.75Z"
          className="fill-current"
          opacity={isDarkMode ? '.8' : '.2'}
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 21 21"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(className, 'pb-1')}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M18.6 8.75C18.6 12.2018 15.8018 15 12.35 15C8.89823 15 6.10001 12.2018 6.10001 8.75C6.10001 5.29822 8.89823 2.5 12.35 2.5C15.8018 2.5 18.6 5.29822 18.6 8.75ZM20.6 8.75C20.6 13.3063 16.9064 17 12.35 17C10.4322 17 8.66726 16.3456 7.26624 15.248L1.80711 20.7071C1.41659 21.0976 0.783424 21.0976 0.392899 20.7071C0.00237502 20.3166 0.00237502 19.6834 0.392899 19.2929L5.85203 13.8338C4.75438 12.4327 4.10001 10.6678 4.10001 8.75C4.10001 4.19365 7.79366 0.5 12.35 0.5C16.9064 0.5 20.6 4.19365 20.6 8.75Z"
        className="fill-current"
      />
    </svg>
  );
}
