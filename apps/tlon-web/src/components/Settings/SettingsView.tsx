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
      className="flex flex-col"
      mainClass="overflow-scroll flex-grow h-full bg-gray-50"
    >
      <Helmet>
        <title>{title}</title>
      </Helmet>

      <div
        className="flex flex-col space-y-4 px-4 pt-4"
        style={{
          paddingBottom: shouldApplyPaddingBottom ? 64 : 0,
        }}
      >
        {!isMobile && (
          <div>
            <h2 className="mb-1 text-lg font-semibold">App Settings</h2>
            <p className="text-gray-600">
              Configure your experience for the Tlon app
            </p>
          </div>
        )}
        <Settings />
      </div>
    </Layout>
  );
}
