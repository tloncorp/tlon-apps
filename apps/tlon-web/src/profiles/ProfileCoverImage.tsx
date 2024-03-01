import cn from 'classnames';
import { PropsWithChildren } from 'react';

import { useCalm } from '@/state/settings';

type CoverProps = PropsWithChildren<{
  cover: string;
  className?: string;
}>;

export default function ProfileCoverImage({
  cover,
  className,
  children,
}: CoverProps) {
  const { disableRemoteContent } = useCalm();

  return (
    <div
      className={cn('rounded-lg bg-cover bg-center relative', className)}
      style={
        cover && !disableRemoteContent
          ? { backgroundImage: `url(${cover})` }
          : {}
      }
    >
      {children}
    </div>
  );
}
