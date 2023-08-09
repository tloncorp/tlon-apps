import { IconProps } from './icon';

export default function CaretLeftIconMobileNav({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      className={className}
      width="32"
      height="32"
      fill="none"
    >
      <path
        className="stroke-current"
        strokeLinecap="round"
        strokeWidth="1.8"
        d="m20 8-7.293 7.293a1 1 0 0 0 0 1.414L20 24"
      />
    </svg>
  );
}
