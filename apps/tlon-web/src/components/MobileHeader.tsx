import cn from 'classnames';
import { Link } from 'react-router-dom';

import { useSafeAreaInsets } from '@/logic/native';

import CaretLeftIconMobileNav from './icons/CaretLeftIconMobileNav';

export default function MobileHeader({
  title,
  secondaryTitle,
  pathBack,
  pathBackText,
  goBack,
  goBackText,
  action,
  secondaryAction,
  className,
  style,
}: {
  title: string | React.ReactNode;
  secondaryTitle?: string | React.ReactNode;
  pathBack?: string;
  goBack?: () => void;
  goBackText?: string;
  pathBackText?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const safeAreaInsets = useSafeAreaInsets();
  return (
    <div
      id="mobile-header"
      className={cn(
        'grid w-full grid-cols-5 justify-between bg-white font-sans text-gray-900',
        className
      )}
      style={{ paddingTop: safeAreaInsets.top, ...style }}
    >
      {goBack ? (
        <div className="h-12 pl-4">
          <button
            className="flex h-12 items-center"
            onClick={() => goBack()}
            type="button"
          >
            <CaretLeftIconMobileNav className="h-8 w-8" />
            {goBackText && (
              <span className="w-0 text-[17px] leading-6">{goBackText}</span>
            )}
          </button>
        </div>
      ) : pathBack ? (
        <div className="h-12 pl-4">
          <Link className="flex h-12 items-center" to={pathBack}>
            <CaretLeftIconMobileNav className="h-8 w-8" />
            {pathBackText && (
              <span className="w-0 text-[17px] leading-6">{pathBackText}</span>
            )}
          </Link>
        </div>
      ) : (
        <div className="h-12 w-12" />
      )}
      <div className="col-span-3 text-center text-[17px] leading-6">
        <div className="flex h-full w-full flex-col items-center justify-center">
          {title}
        </div>
      </div>
      {action ? (
        <div className="h-12  pr-4">
          {action}
          {secondaryAction}
        </div>
      ) : (
        <div className="h-12 w-12" />
      )}
    </div>
  );
}
