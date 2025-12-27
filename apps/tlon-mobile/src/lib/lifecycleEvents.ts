import { lastAppVersion } from '@tloncorp/shared/db';
import * as Application from 'expo-application';

export async function checkLatestVersion() {
  const lastVersion = await lastAppVersion.getValue();

  const buildVersion = Application.nativeBuildVersion;
  const currentVersion = buildVersion ?? 'unknown';

  lastAppVersion.setValue(currentVersion);
  if (!lastVersion) {
    return { status: 'installed', version: currentVersion };
  }

  if (lastVersion !== currentVersion) {
    return { status: 'updated', version: currentVersion };
  }

  return { status: 'unchanged', version: currentVersion };
}
