import { IconProps } from './icon';

export default function AddIconMobileNav({ className }: IconProps) {
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
        d="M16 16V7m0 9h9m-9 0H7m9 0v9"
      />
    </svg>
  );
}
