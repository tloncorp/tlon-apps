import { ViewProps } from '@tloncorp/shared/dist/urbit/groups';
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';

import Layout from '@/components/Layout/Layout';
import MobileHeader from '@/components/MobileHeader';
import QRWidget, { QRWidgetPlaceholder } from '@/components/QRWidget';
import { getDmLink } from '@/logic/branch';
import { useIsMobile } from '@/logic/useMedia';
import useShowTabBar from '@/logic/useShowTabBar';

export default function ShareDMLure({ title }: ViewProps) {
  const isMobile = useIsMobile();

  const showTabBar = useShowTabBar();
  const shouldApplyPaddingBottom = showTabBar;

  const [dmLink, setDmLink] = useState('');

  useEffect(() => {
    async function populateLink() {
      const link = await getDmLink();
      setDmLink(link || '');
    }
    populateLink();
  }, []);

  return (
    <Layout
      header={
        isMobile ? (
          <MobileHeader title="Share with Friends" pathBack="/profile" />
        ) : null
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
            <h2 className="mb-1 text-lg font-semibold">Share with Friends</h2>
            <p className="text-gray-600">
              Share the Tlon app with friends, invite them to join
            </p>
          </div>
        )}
        <div className="card">
          <div className="mb-4">
            <h2 className="mb-1 text-lg font-semibold">
              Invite someone from outside the Urbit network
            </h2>
            <p className="text-gray-600">Courtesy of Tlon Hosting</p>
          </div>
          <p className="mb-4 leading-5 text-gray-800">
            Have friends, family or collaborators who aren’t on Urbit? You can
            now gift them an Urbit ID and onboard them to your group all in one
            free and easy sweep. Just copy and share the link below.
          </p>
          {dmLink ? (
            <QRWidget
              link={dmLink}
              navigatorTitle={`Connect with ${window.our}`}
            />
          ) : (
            <QRWidgetPlaceholder />
          )}
        </div>
      </div>
    </Layout>
  );
}
