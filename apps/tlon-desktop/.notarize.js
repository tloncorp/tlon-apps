const { notarize } = require('@electron/notarize');
const { build } = require('./package.json');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  
  // Only notarize macOS builds
  if (electronPlatformName !== 'darwin') {
    return;
  }

  // Don't notarize during development
  if (process.env.NOTARIZE === 'false') {
    console.log('Skipping notarization');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appBundleId = build.appId;

  console.log(`Notarizing ${appName} (${appBundleId})...`);

  try {
    await notarize({
      tool: 'notarytool',
      appPath: `${appOutDir}/${appName}.app`,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    });
    console.log(`Notarization completed successfully`);
  } catch (error) {
    console.error('Notarization failed:', error);
    throw error;
  }
};
