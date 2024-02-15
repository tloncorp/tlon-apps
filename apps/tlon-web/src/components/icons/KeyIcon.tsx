import { IconProps } from './icon';

export default function KeyIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      className={className}
    >
      <path
        className="fill-current"
        fillRule="evenodd"
        d="M18 8.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm2 0a4.5 4.5 0 0 1-6.896 3.81L10.414 15l1.293 1.293a1 1 0 0 1-1.414 1.414L9 16.414 7.414 18l1.293 1.293a1 1 0 1 1-1.414 1.414l-2-2a1 1 0 0 1 0-1.414l3-3 3.397-3.397A4.5 4.5 0 1 1 20 8.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
