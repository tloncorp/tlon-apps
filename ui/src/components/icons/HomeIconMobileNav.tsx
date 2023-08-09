import { IconProps } from './icon';

export default function HomeIconMobileNav({
  className,
  isInactive,
  isDarkMode,
}: { isInactive?: boolean; isDarkMode?: boolean } & IconProps) {
  if (isInactive) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 25 25"
        className={className}
        fill="none"
      >
        <path
          className="stroke-current"
          strokeWidth="2"
          d="M3.24 11.864a3.5 3.5 0 0 1 1.024-2.475l7.061-7.06a2 2 0 0 1 2.829 0l7.06 7.06a3.5 3.5 0 0 1 1.025 2.475V22a.5.5 0 0 1-.5.5h-6.5v-6.125c0-.76-.615-1.375-1.375-1.375h-2.25c-.76 0-1.375.616-1.375 1.375V22.5h-6.5a.5.5 0 0 1-.5-.5V11.864Z"
          opacity={isDarkMode ? '.8' : '0.2'}
        />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 25 25"
      className={className}
    >
      <path
        className="fill-current"
        d="M2.24 11.864a4.5 4.5 0 0 1 1.317-3.182l7.06-7.06a3 3 0 0 1 4.244 0l7.06 7.06a4.5 4.5 0 0 1 1.318 3.182V22a1.5 1.5 0 0 1-1.5 1.5h-6.75a.75.75 0 0 1-.75-.75v-6.375a.375.375 0 0 0-.375-.375h-2.25a.375.375 0 0 0-.375.375v6.375a.75.75 0 0 1-.75.75H3.74a1.5 1.5 0 0 1-1.5-1.5V11.864Z"
      />
    </svg>
  );
}
