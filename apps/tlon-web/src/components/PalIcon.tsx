import { usePals } from '@/state/pals';
import cn from 'classnames';
import _ from 'lodash';
import { useMemo } from 'react';

const outgoingSvg = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M5.5 10.5L10.5 5.5M10.5 5.5H6.5M10.5 5.5V9"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const incomingSvg = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M10.5 5.5L5.5 10.5M5.5 10.5H9.5M5.5 10.5V7"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const mutualSvg = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g id="Utility Icons (16px)">
      <path
        id="Union"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.5 5.5C6.5 5.08579 6.16421 4.75 5.75 4.75C5.33579 4.75 5 5.08579 5 5.5V6.87923C5 7.29345 5.33579 7.62923 5.75 7.62923C6.16421 7.62923 6.5 7.29345 6.5 6.87923V5.5ZM10.2484 4.75C10.6626 4.75 10.9984 5.08579 10.9984 5.5V6.87923C10.9984 7.29345 10.6626 7.62923 10.2484 7.62923C9.83419 7.62923 9.4984 7.29345 9.4984 6.87923V5.5C9.4984 5.08579 9.83419 4.75 10.2484 4.75ZM10.6718 9.70353C10.9766 9.98395 10.9766 10.4386 10.6718 10.719C9.19575 12.0767 6.80265 12.0767 5.32664 10.719C5.02177 10.4386 5.02177 9.98395 5.32664 9.70353C5.6315 9.42312 6.12577 9.42312 6.43063 9.70353C7.29693 10.5004 8.70147 10.5004 9.56777 9.70353C9.87263 9.42312 10.3669 9.42312 10.6718 9.70353Z"
        fill="currentColor"
      />
    </g>
  </svg>
);

export default function PalIcon(props: { ship: string; className?: string }) {
  const { ship } = props;
  const pals = usePals();

  const tags: Array<string> | null = useMemo(() => {
    const out = pals.outgoing[ship.slice(1)];
    if (!out) {
      return null;
    }
    return out.lists;
  }, [ship, pals]);

  const incoming: boolean = useMemo(
    () => !!pals.incoming[ship.slice(1)],
    [ship, pals]
  );

  const className = cn(
    'rounded-full inline-block align-middle',
    props.className
  );

  if (!tags) {
    if (!incoming) {
      return null;
    }
    return (
      <div
        className={cn(
          'rounded-full bg-gray-100 text-gray-600 dark:bg-gray-400 dark:text-white',
          className
        )}
      >
        {incomingSvg}
      </div>
    );
  }
  if (!incoming) {
    return (
      <div
        className={cn(
          'rounded-full bg-gray-100 text-gray-600 dark:bg-gray-400 dark:text-white',
          className
        )}
        title={tags.join(', ')}
      >
        {outgoingSvg}
      </div>
    );
  }
  return (
    <div
      className={cn(
        'rounded-full bg-green-100 text-green-500 dark:bg-green-500 dark:text-white',
        className
      )}
      title={tags.join(', ')}
    >
      {mutualSvg}
    </div>
  );
}
