import { IconProps } from './icon';

export default function PlaceholderIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
    >
      <rect
        width="16.2"
        height="16.2"
        x="2.503"
        y="5.594"
        className="stroke-current"
        strokeWidth="1.8"
        rx="3.1"
        transform="rotate(-11 2.503 5.594)"
      />
    </svg>
  );
}
