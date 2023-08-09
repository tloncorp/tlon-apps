import { IconProps } from './icon';

export default function FilterIconMobileNav({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      className={className}
      fill="none"
    >
      <path
        className="stroke-current"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        d="M7 8.8h18M10.6 16h10.8m-3.6 7.2h-3.6"
      />
    </svg>
  );
}
