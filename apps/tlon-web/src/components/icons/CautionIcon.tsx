import { IconProps } from './icon';

export default function CautionIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21ZM12.002 7C12.4846 7 12.8728 7.39709 12.8617 7.87961L12.7485 12.8413C12.7392 13.2478 12.407 13.5726 12.0003 13.5726C11.5934 13.5726 11.261 13.2475 11.252 12.8407L11.1422 7.87901C11.1315 7.39672 11.5196 7 12.002 7ZM13 15.4089C12.9955 15.9635 12.5364 16.4089 12 16.4089C11.4455 16.4089 10.9955 15.9635 11 15.4089C10.9955 14.8635 11.4455 14.4181 12 14.4181C12.5364 14.4181 12.9955 14.8635 13 15.4089Z"
        className="fill-current"
      />
    </svg>
  );
}
