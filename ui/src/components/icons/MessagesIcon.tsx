import { IconProps } from './icon';

export default function MessagesIcon({
  className,
  isInactive,
}: { isInactive?: boolean } & IconProps) {
  if (isInactive) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 25 24"
        className={className}
        fill="none"
      >
        <path
          className="stroke-current"
          strokeOpacity=".2"
          strokeWidth="2"
          d="M3.34 6a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v7a4 4 0 0 1-4 4h-2.95a.123.123 0 0 0-.086.036L9.55 21.79a.123.123 0 0 1-.21-.087v-4.58A.123.123 0 0 0 9.217 17H7.34a4 4 0 0 1-4-4V6Z"
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
        d="M3.34 6a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v7a4 4 0 0 1-4 4h-2.95a.123.123 0 0 0-.086.036l-4.11 4.11a.5.5 0 0 1-.854-.353v-3.67A.123.123 0 0 0 9.217 17H7.34a4 4 0 0 1-4-4V6Z"
      />
    </svg>
  );
}
