import { ViewProps } from '@tloncorp/shared/dist/urbit/groups';
import { Helmet } from 'react-helmet';

import { useBottomPadding } from '@/logic/position';
import { useIsMobile } from '@/logic/useMedia';

import Layout from '../Layout/Layout';
import MobileHeader from '../MobileHeader';
import About from './About';

export default function AboutView({ title }: ViewProps) {
  const isMobile = useIsMobile();
  const { paddingBottom } = useBottomPadding();

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
          paddingBottom,
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
