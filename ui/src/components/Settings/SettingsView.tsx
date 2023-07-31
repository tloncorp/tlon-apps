import { useIsMobile } from '@/logic/useMedia';
import { ViewProps } from '@/types/groups';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import CaretLeftIcon from '../icons/CaretLeftIcon';
import Layout from '../Layout/Layout';
import Settings from './Settings';

export default function SettingsView({ title }: ViewProps) {
  const isMobile = useIsMobile();

  return (
    <Layout
      header={
        isMobile ? (
          <div className="flex w-full items-center justify-between bg-white py-2 pl-2 pr-4">
            <Link to="/profile">
              <CaretLeftIcon className="h-6 w-6 text-gray-800" />
            </Link>
            <span className="ellipsis text-[18px] leading-5 text-gray-800 line-clamp-1">
              App Settings
            </span>
            <div className="h-6 w-6" />
          </div>
        ) : null
      }
      className="flex-1 p-4"
    >
      <Helmet>
        <title>{title}</title>
      </Helmet>
      <div className="h-full overflow-y-auto pt-[10px]">
        <Settings />
      </div>
    </Layout>
  );
}
