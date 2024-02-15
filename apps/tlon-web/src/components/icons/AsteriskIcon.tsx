import { IconProps } from './icon';

export default function AsteriskIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        className="fill-current"
        fillRule="evenodd"
        d="M12 2.1a.9.9 0 0 1 .9.9v6.827L17.729 5a.9.9 0 1 1 1.273 1.272L14.173 11.1H21a.9.9 0 1 1 0 1.8h-6.827l4.828 4.828A.9.9 0 0 1 17.728 19L12.9 14.173V21a.9.9 0 1 1-1.8 0v-6.827L6.274 19A.9.9 0 1 1 5 17.728L9.828 12.9H3a.9.9 0 1 1 0-1.8h6.828L5 6.272A.9.9 0 0 1 6.273 5L11.1 9.827V3a.9.9 0 0 1 .9-.9Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
