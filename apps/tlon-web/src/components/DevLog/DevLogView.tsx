import { ViewProps } from '@tloncorp/shared/dist/urbit/groups';
import cn from 'classnames';
import { Helmet } from 'react-helmet';

import { useBottomPadding } from '@/logic/position';
import { useIsMobile } from '@/logic/useMedia';

import Layout from '../Layout/Layout';
import MobileHeader from '../MobileHeader';
import DevLog from './DevLog';

export default function DevLogsView({ title }: ViewProps) {
  const isMobile = useIsMobile();
  const { paddingBottom } = useBottomPadding();

  return (
    <Layout
      header={
        isMobile ? (
          <MobileHeader title="Developer Logs" pathBack="/profile/about" />
        ) : null
      }
      className="flex flex-col"
      mainClass="overflow-scroll flex-grow h-full bg-gray-50"
    >
      <Helmet>
        <title>{title}</title>
      </Helmet>

      <div
        className={cn(
          'flex h-full flex-col space-y-4',
          isMobile ? 'pt-4' : 'px-4'
        )}
        style={{
          paddingBottom,
        }}
      >
        <DevLog />
      </div>
    </Layout>
  );
}
