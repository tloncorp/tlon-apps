import { IconProps } from './icon';

export default function MagnifyingGlassMobileNavIcon({
  className,
  isInactive,
}: { isInactive?: boolean } & IconProps) {
  if (isInactive) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 25 24"
        className={className}
      >
        <path
          className="fill-current"
          fillRule="evenodd"
          d="M21.04 9.75a6.25 6.25 0 1 1-12.5 0 6.25 6.25 0 0 1 12.5 0Zm2 0a8.25 8.25 0 0 1-13.334 6.498l-5.46 5.46a1 1 0 0 1-1.414-1.415l5.46-5.46A8.25 8.25 0 1 1 23.04 9.75Z"
          clipRule="evenodd"
          opacity=".2"
        />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 25 24"
      className={className}
    >
      <path
        className="fill-current"
        fillRule="evenodd"
        d="M21.04 9.75a6.25 6.25 0 1 1-12.5 0 6.25 6.25 0 0 1 12.5 0Zm2 0a8.25 8.25 0 0 1-13.334 6.498l-5.46 5.46a1 1 0 0 1-1.414-1.415l5.46-5.46A8.25 8.25 0 1 1 23.04 9.75Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
