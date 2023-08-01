import { Link } from 'react-router-dom';
import CaretLeftIcon from './icons/CaretLeftIcon';

export default function MobileHeader({
  title,
  pathBack,
}: {
  title: string;
  pathBack?: string;
}) {
  return pathBack ? (
    <div className="flex w-full items-center justify-between bg-white py-2 pl-2 pr-4">
      <Link to={pathBack}>
        <CaretLeftIcon className="h-6 w-6 text-gray-400" />
      </Link>
      <span className="ellipsis text-[18px] leading-5 text-gray-800 line-clamp-1">
        {title}
      </span>
      <div className="h-6 w-6" />
    </div>
  ) : (
    <div className="flex w-full items-center justify-center bg-white py-2 pl-2 pr-4">
      <span className="ellipsis text-[18px] leading-5 text-gray-800 line-clamp-1">
        {title}
      </span>
    </div>
  );
}
