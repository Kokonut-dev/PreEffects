const { execFileSync } = require('node:child_process');
const path = require('node:path');

/**
 * Ad-hoc signs macOS .app bundles when building without an Apple Developer ID certificate
 * so Apple Silicon (arm64) Mach-O code signature seals remain valid after Electron repackaging.
 */
async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin' || process.platform !== 'darwin') {
    return;
  }
  const hasRealCert = Boolean(process.env.CSC_LINK);
  if (hasRealCert) {
    return;
  }
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  try {
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
    console.log(`[afterPack] Applied Apple Silicon ad-hoc signature to ${appPath}`);
  } catch (err) {
    console.warn('[afterPack] Ad-hoc codesign warning:', err);
  }
}

module.exports = afterPack;
module.exports.default = afterPack;
