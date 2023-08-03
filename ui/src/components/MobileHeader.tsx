import { Link } from 'react-router-dom';
import CaretLeftIconMobileNav from './icons/CaretLeftIconMobileNav';

export default function MobileHeader({
  title,
  pathBack,
  pathBackText,
  action,
  secondaryAction,
}: {
  title: string | React.ReactNode;
  pathBack?: string;
  pathBackText?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-[48px] w-full grid-cols-3 justify-between bg-white py-2 px-6 font-system-sans">
      {pathBack ? (
        <Link className="flex" to={pathBack}>
          <CaretLeftIconMobileNav className="h-8 w-8 text-gray-900" />
          {pathBackText && (
            <span className="text-[17px] leading-6 text-gray-800 line-clamp-1">
              {pathBackText}
            </span>
          )}
        </Link>
      ) : (
        <div className="h-6 w-6" />
      )}
      <div className="flex items-center justify-center">
        <span className="items-center text-center text-[18px] leading-6 text-gray-800 line-clamp-1">
          {title}
        </span>
      </div>
      {action ? (
        <div className="flex justify-end space-x-3">
          {action}
          {secondaryAction}
        </div>
      ) : (
        <div className="h-6 w-6" />
      )}
    </div>
  );
}
