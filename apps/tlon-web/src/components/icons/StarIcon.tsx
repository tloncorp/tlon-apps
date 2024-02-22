import { IconProps } from './icon';

export default function StarIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      className={className}
    >
      <path
        className="fill-current"
        d="M11.055 3.717c.312-.895 1.578-.895 1.89 0l1.413 4.066a1 1 0 0 0 .924.671l4.303.088c.948.02 1.34 1.224.584 1.797l-3.43 2.6a1 1 0 0 0-.353 1.087l1.247 4.12c.274.907-.75 1.651-1.529 1.11l-3.533-2.459a1 1 0 0 0-1.142 0l-3.533 2.459c-.778.541-1.803-.203-1.529-1.11l1.247-4.12a1 1 0 0 0-.353-1.087l-3.43-2.6c-.756-.573-.364-1.777.584-1.797l4.303-.088a1 1 0 0 0 .924-.671l1.413-4.066Z"
      />
    </svg>
  );
}
