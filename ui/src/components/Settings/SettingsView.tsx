import { useIsMobile } from '@/logic/useMedia';
import { ViewProps } from '@/types/groups';
import { Helmet } from 'react-helmet';
import Layout from '../Layout/Layout';
import MobileHeader from '../MobileHeader';
import Settings from './Settings';

export default function SettingsView({ title }: ViewProps) {
  const isMobile = useIsMobile();

  return (
    <Layout
      header={
        isMobile ? (
          <MobileHeader title="App Settings" pathBack="/profile" />
        ) : null
      }
      className="flex-1 px-4 pt-4"
    >
      <Helmet>
        <title>{title}</title>
      </Helmet>
      <div className="h-screen overflow-y-scroll pt-8 px-8">
        <Settings />
      </div>
    </Layout>
  );
}
