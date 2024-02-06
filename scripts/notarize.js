// scripts/notarize.js
const { notarize } = require('@electron/notarize');

console.log('notarize.js loaded');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;

  return await notarize({
    appBundleId: 'io.shoprocket.app', // Your app's bundle ID
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_ID_PASSWORD,
    teamId: process.env.CSC_TEAM_IDENTIFIER, 
    tool: "notarytool"
    // ascProvider can be added if needed, but the tool option is removed
  });
};
