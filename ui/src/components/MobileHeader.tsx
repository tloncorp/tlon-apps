import { Link } from 'react-router-dom';
import CaretLeftIconMobileNav from './icons/CaretLeftIconMobileNav';

export default function MobileHeader({
  title,
  secondaryTitle,
  pathBack,
  pathBackText,
  action,
  secondaryAction,
}: {
  title: string | React.ReactNode;
  secondaryTitle?: string | React.ReactNode;
  pathBack?: string;
  pathBackText?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}) {
  return (
    <div className="grid w-full grid-cols-4 justify-between bg-white font-system-sans">
      {pathBack ? (
        <div className="h-12 pl-4">
          <Link className="flex h-12 items-center" to={pathBack}>
            <CaretLeftIconMobileNav className="h-8 w-8 text-gray-900" />
            {pathBackText && (
              <span className="text-[17px] leading-6 text-gray-900">
                {pathBackText}
              </span>
            )}
          </Link>
        </div>
      ) : (
        <div className="h-12 w-12" />
      )}
      <div className="col-span-2 text-center text-[17px] leading-6 text-gray-800">
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
