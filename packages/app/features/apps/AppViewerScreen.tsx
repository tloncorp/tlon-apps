import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { useMemo } from 'react';
import { Platform } from 'react-native';

import {
  AppWebView,
  ScreenHeader,
  View,
} from '../../ui';

type AppViewerRouteParams = {
  AppViewer: { desk: string };
};

export function AppViewerScreen() {
  const route = useRoute<RouteProp<AppViewerRouteParams, 'AppViewer'>>();
  const navigation = useNavigation();
  const isWindowNarrow = useIsWindowNarrow();
  const { data: apps = [] } = store.useInstalledApps();
  const shipInfo = db.shipInfo.useValue();

  const desk = route.params?.desk;
  const charge = useMemo(
    () => apps.find((app) => app.desk === desk),
    [apps, desk]
  );

  // Native needs an absolute URL; web uses a relative path served by the same
  // ship that hosts Tlon.
  const shipUrl =
    Platform.OS === 'web' ? undefined : shipInfo?.shipUrl ?? undefined;

  // Site charges are served from an arbitrary path; glob charges live under
  // /apps/{base}/ where base usually matches the desk name.
  const path = useMemo(() => {
    if (charge && 'site' in charge.href) return charge.href.site;
    if (charge && 'glob' in charge.href) {
      const base = charge.href.glob.base || desk;
      return `/apps/${base}/`;
    }
    return desk ? `/apps/${desk}/` : null;
  }, [charge, desk]);

  if (!desk || !path) {
    return (
      <View flex={1} backgroundColor="$background">
        <ScreenHeader
          title="App"
          backAction={() => navigation.goBack()}
        />
      </View>
    );
  }

  return (
    <View flex={1} backgroundColor="$background">
      {isWindowNarrow && (
        <ScreenHeader
          title={charge?.title ?? desk}
          backAction={() => navigation.goBack()}
        />
      )}
      <AppWebView
        shipUrl={shipUrl}
        path={path}
        cacheKey={`app:${desk}`}
      />
    </View>
  );
}
