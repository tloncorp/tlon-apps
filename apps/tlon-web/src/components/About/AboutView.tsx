import { ViewProps } from '@tloncorp/shared/dist/urbit/groups';
import { Helmet } from 'react-helmet';

import { isNativeApp } from '@/logic/native';
import { useIsMobile } from '@/logic/useMedia';
import useShowTabBar from '@/logic/useShowTabBar';

import Layout from '../Layout/Layout';
import MobileHeader from '../MobileHeader';
import About from './About';

export default function AboutView({ title }: ViewProps) {
  const isMobile = useIsMobile();

  const showTabBar = useShowTabBar();
  const shouldApplyPaddingBottom = showTabBar;
  const paddingBottom = isNativeApp() ? 64 : 50;

  return (
    <Layout
      header={
        isMobile ? <MobileHeader title="About" pathBack="/profile" /> : null
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
          paddingBottom: shouldApplyPaddingBottom ? paddingBottom : 0,
        }}
      >
        {!isMobile && (
          <div>
            <h2 className="mb-1 text-lg font-semibold">App Info</h2>
            <p className="text-gray-600">
              App version, debug, and update provider information
            </p>
          </div>
        )}
        <About />
      </div>
    </Layout>
  );
}
