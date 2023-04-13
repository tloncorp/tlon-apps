import { IconProps } from './icon';

export default function PencilSettingsIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 18 18"
      fill="none"
    >
      <path
        fillRule="evenodd"
        d="M12.707 1.707A1 1 0 1 0 11.293.293l-9 9a1 1 0 0 0-.255.432l-2 7a1 1 0 0 0 1.237 1.236l7-2a1 1 0 0 0 .432-.254l9-9a1 1 0 1 0-1.414-1.414L7.476 14.11l-3.04.868 13.271-13.27A1 1 0 1 0 16.293.292L3.022 13.564l.868-3.04 8.817-8.817ZM12 16a1 1 0 1 0 0 2h5a1 1 0 1 0 0-2h-5Z"
        clipRule="evenodd"
        className="fill-current"
      />
    </svg>
  );
}
