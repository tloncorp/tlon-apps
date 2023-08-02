import { Link } from 'react-router-dom';
import CaretLeftIcon from './icons/CaretLeftIcon';

export default function MobileHeader({
  title,
  pathBack,
  pathBackText,
  action,
  secondaryAction,
}: {
  title: string;
  pathBack?: string;
  pathBackText?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}) {
  return (
    <div className="grid w-full grid-cols-3 items-center justify-between bg-white py-3 pl-2 pr-4 font-system-sans">
      {pathBack ? (
        <Link className="flex items-center" to={pathBack}>
          <CaretLeftIcon className="h-6 w-6 text-gray-400" />
          {pathBackText && (
            <span className="text-[17px] leading-6 text-gray-800 line-clamp-1">
              Cancel
            </span>
          )}
        </Link>
      ) : (
        <div className="h-6 w-6" />
      )}
      <span className="ellipsis items-center text-center text-[18px] leading-6 text-gray-800 line-clamp-1">
        {title}
      </span>
      {action ? (
        <div className="flex items-center justify-end space-x-3">
          {action}
          {secondaryAction}
        </div>
      ) : (
        <div className="h-6 w-6" />
      )}
    </div>
  );
}
