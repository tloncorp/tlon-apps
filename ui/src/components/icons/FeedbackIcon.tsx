import { IconProps } from './icon';

export default function FeedbackIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
    >
      <path
        className="stroke-current"
        strokeWidth="1.8"
        d="M2.308 10.23A6.23 6.23 0 0 1 8.538 4h6.923a6.23 6.23 0 0 1 0 12.462h-.689c-.002 0-.004 0-.005.002l-4.354 4.354a.692.692 0 0 1-1.182-.49v-3.86a.007.007 0 0 0-.007-.006h-.686a6.23 6.23 0 0 1-6.23-6.231Z"
      />
    </svg>
  );
}
