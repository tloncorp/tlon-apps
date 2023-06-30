import { useMemo } from 'react';
import _ from 'lodash';
import cn from 'classnames';
import { usePals } from '@/state/pals';

const outgoingSvg = (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M50 95
C44.0905 95 38.2389 93.836 32.7792 91.5746
C27.3196 89.3131 22.3588 85.9984 18.1802 81.8198
C14.0016 77.6412 10.6869 72.6804 8.42542 67.2208
C6.16396 61.7611 5 55.9095 5 50"
      stroke="currentColor"
      strokeWidth="10"
    />
    <path
      d="M30.5546 65.9099
L28.7868 67.6777
L32.3223 71.2132
L34.0901 69.4454
L30.5546 65.9099
Z
M67.6777 32.3223
L39.7938 39.7938
L60.2062 60.2062
L67.6777 32.3223
Z
M34.0901 69.4454
L53.5355 50
L50 46.4645
L30.5546 65.9099
L34.0901 69.4454
Z"
      fill="currentColor"
    />
  </svg>
);

const incomingSvg = (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M95 50
C95 55.9095 93.836 61.7611 91.5746 67.2208
C89.3131  72.6804 85.9984 77.6412 81.8198 81.8198
C77.6412 85.9984 72.6804 89.3131 67.2208 91.5746
C61.7611 93.836 55.9095 95 50 95"
      stroke="currentColor"
      strokeWidth="10"
    />
    <path
      d="M67.2383 68.7383
L59.7669 40.8545
L39.3545 61.2669
L67.2383 68.7383
Z
M31.5294 29.4939
L29.7617 27.7262
L26.2261 31.2617
L27.9939 33.0295
L31.5294 29.4939
Z
M53.0962 51.0607
L31.5294 29.4939
L27.9939 33.0295
L49.5607 54.5962
L53.0962 51.0607
Z"
      fill="currentColor"
    />
  </svg>
);

const mutualSvg = (
  <svg viewBox="13 0 113 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M108 50
C108 61.9348 103.259 73.3807 94.8198 81.8198
C86.3807 90.2589 74.9347 95 63 95
C51.0653 95 39.6193 90.2589 31.1802 81.8198
C22.7411 73.3807 18 61.9347 18 50"
      stroke="currentColor"
      strokeWidth="10"
    />
    <path
      d="M87.5114 31.5994
C87.5114 28.4354 84.9226 25.8466 81.7585 25.8466
C78.5945 25.8466 76.0057 28.4354 76.0057 31.5994
C76.0057 34.7635 78.5945 37.3523 81.7585 37.3523
C84.9226 37.3523 87.5114 34.7635 87.5114 31.5994
Z
M51.0767 31.5994
C51.0767 28.4354 48.4879 25.8466 45.3239 25.8466
C42.1598 25.8466 39.571 28.4354 39.571 31.5994
C39.571 34.7635 42.1598 37.3523 45.3239 37.3523
C48.4879 37.3523 51.0767 34.7635 51.0767 31.5994
Z"
      fill="currentColor"
    />
  </svg>
);

export default function PalIcon(props: { ship: string; className: string }) {
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
    'h-5 w-5 p-1 rounded-full inline-block align-middle',
    props.className
  );

  if (!tags) {
    if (!incoming) {
      return null;
    }
    return <div className={cn('bg-gray-100', className)}>{incomingSvg}</div>;
  }
  if (!incoming) {
    return (
      <div className={cn('bg-yellow-soft', className)} title={tags.join(', ')}>
        {outgoingSvg}
      </div>
    );
  }
  return (
    <div className={cn('bg-green-100', className)} title={tags.join(', ')}>
      {mutualSvg}
    </div>
  );
}
