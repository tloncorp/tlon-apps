import { IconProps } from './icon';

export default function GiftIcon({ className }: IconProps) {
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
        d="M5.571 2.1A3.471 3.471 0 0 0 2.1 5.571V18.43A3.471 3.471 0 0 0 5.57 21.9h12.857a3.471 3.471 0 0 0 3.472-3.471V5.57A3.471 3.471 0 0 0 18.428 2.1H5.571Z"
      />
      <path
        className="stroke-current"
        strokeLinecap="round"
        strokeWidth="1.8"
        d="M12 12V3m0 9h9m-9 0v9m0-9H3M6.857 17.143 12 12m0 0 5.143 5.143M12 12l2.637-5.275c.6-1.2 2.2-1.46 3.149-.51v0c.948.948.689 2.547-.511 3.148L12 12Zm0 0L9.363 6.725c-.6-1.2-2.2-1.46-3.149-.51v0a1.966 1.966 0 0 0 .511 3.148L12 12Z"
      />
    </svg>
  );
}
