import { ViewProps } from '@tloncorp/shared/dist/urbit/groups';
import { Helmet } from 'react-helmet';

import { useIsMobile } from '@/logic/useMedia';

import Layout from '../Layout/Layout';
import MobileHeader from '../MobileHeader';
import Settings from './Settings';

export default function SettingsView({ title }: ViewProps) {
  const isMobile = useIsMobile();

  return (
    <Layout
      header={
        isMobile ? <MobileHeader title="Settings" pathBack="/profile" /> : null
      }
      className="flex flex-col overflow-y-auto"
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
