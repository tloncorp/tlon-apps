import {
  RouteProp,
  useFocusEffect,
  useIsFocused,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { useSetFocusedDesk } from '../../hooks/useOpenApps';
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
  const isFocused = useIsFocused();
  const { data: apps = [] } = store.useInstalledApps();
  const shipInfo = db.shipInfo.useValue();

  const desk = route.params?.desk;
  const charge = useMemo(
    () => apps.find((app) => app.desk === desk),
    [apps, desk]
  );

  const setFocusedDesk = useSetFocusedDesk();
  useFocusEffect(
    useCallback(() => {
      if (!desk) return;
      store.recordVisit({ kind: 'app', id: desk });
      setFocusedDesk(desk);
      return () => setFocusedDesk(null);
    }, [desk, setFocusedDesk])
  );

  // Title falls back to the charge title; once the iframe loads we override
  // with the embedded document's title (e.g., the page title set by the
  // app's router). Pushed via `setOptions` so the documentTitle formatter
  // (in app.tsx) honors it instead of defaulting to the screen name.
  const [iframeTitle, setIframeTitle] = useState<string | null>(null);
  useEffect(() => {
    setIframeTitle(null);
  }, [desk]);
  const screenTitle = iframeTitle || charge?.title || desk || null;
  useEffect(() => {
    if (screenTitle) navigation.setOptions({ title: screenTitle });
  }, [navigation, screenTitle]);

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
        paused={!isFocused}
        onTitleChange={setIframeTitle}
      />
    </View>
  );
}
