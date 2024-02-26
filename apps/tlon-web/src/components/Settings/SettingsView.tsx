import { ViewProps } from '@tloncorp/shared/dist/urbit/groups';
import { Helmet } from 'react-helmet';

import { useIsMobile } from '@/logic/useMedia';
import useShowTabBar from '@/logic/useShowTabBar';

import Layout from '../Layout/Layout';
import MobileHeader from '../MobileHeader';
import Settings from './Settings';

export default function SettingsView({ title }: ViewProps) {
  const isMobile = useIsMobile();

  const showTabBar = useShowTabBar();
  const shouldApplyPaddingBottom = showTabBar;

  return (
    <Layout
      header={
        isMobile ? <MobileHeader title="Settings" pathBack="/profile" /> : null
      }
      className="flex flex-col overflow-y-auto"
      style={{
        paddingBottom: shouldApplyPaddingBottom ? 64 : 0,
      }}
    >
      <Helmet>
        <title>{title}</title>
      </Helmet>

      <div className="px-6 pt-8">
        <Settings />
      </div>
    </Layout>
  );
}
