import { getEasUpdateDisplay } from '@tloncorp/app/lib/platformHelpers';
import { lastAppVersion } from '@tloncorp/shared/db';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';

export async function checkLatestVersion() {
  const lastVersion = await lastAppVersion.getValue();

  const buildVersion = Application.nativeBuildVersion;
  const otaVersion = getEasUpdateDisplay(Updates);
  const currentVersion = `${buildVersion}:${otaVersion}`;

  lastAppVersion.setValue(currentVersion);
  if (!lastVersion) {
    return { status: 'installed', version: currentVersion };
  }

  if (lastVersion !== currentVersion) {
    return { status: 'updated', version: currentVersion };
  }

  return { status: 'unchanged', version: currentVersion };
}
