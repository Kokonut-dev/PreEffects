export interface GitHubReleaseAssetMeta {
  name: string;
  browser_download_url: string;
  size: number;
  digest?: string | null;
}

export interface GitHubReleasePayload {
  tag_name?: string;
  name?: string;
  body?: string;
  published_at?: string;
  html_url?: string;
  assets?: GitHubReleaseAssetMeta[];
}

export function normalizeSemver(raw: string): [number, number, number] {
  const cleaned = raw.trim().replace(/^v/i, '').split('-')[0];
  const parts = cleaned.split('.').map((n) => parseInt(n, 10));
  return [
    Number.isFinite(parts[0]) ? parts[0] : 0,
    Number.isFinite(parts[1]) ? parts[1] : 0,
    Number.isFinite(parts[2]) ? parts[2] : 0,
  ];
}

/**
 * Returns 1 if `candidate` > `current`, -1 if `<`, 0 if equal.
 */
export function compareSemver(candidate: string, current: string): -1 | 0 | 1 {
  const a = normalizeSemver(candidate);
  const b = normalizeSemver(current);
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return 1;
    if (a[i] < b[i]) return -1;
  }
  return 0;
}

/**
 * Selects the best GitHub Release installer asset for the given OS platform and CPU architecture.
 */
export function pickPlatformReleaseAsset(
  assets: GitHubReleaseAssetMeta[],
  platform: string,
  arch: string,
): GitHubReleaseAssetMeta | undefined {
  if (!Array.isArray(assets) || assets.length === 0) return undefined;
  const lower = assets.map((a) => ({ asset: a, name: a.name.toLowerCase() }));

  if (platform === 'darwin') {
    const archToken = arch === 'arm64' ? 'arm64' : 'x64';
    const oppositeToken = arch === 'arm64' ? 'x64' : 'arm64';
    // Prefer .dmg or .zip matching exact CPU arch (arm64 on Apple Silicon)
    return (
      lower.find((x) => x.name.endsWith('.dmg') && x.name.includes(archToken))?.asset ??
      lower.find((x) => x.name.endsWith('.zip') && x.name.includes('mac') && x.name.includes(archToken))?.asset ??
      lower.find((x) => x.name.endsWith('.dmg') && !x.name.includes(oppositeToken))?.asset ??
      lower.find((x) => x.name.endsWith('.zip') && !x.name.includes('win') && !x.name.includes('linux') && !x.name.includes(oppositeToken))?.asset
    );
  }

  if (platform === 'win32') {
    return (
      lower.find((x) => x.name.endsWith('.exe') && x.name.includes('setup'))?.asset ??
      lower.find((x) => x.name.endsWith('.exe'))?.asset
    );
  }

  if (platform === 'linux') {
    return (
      lower.find((x) => x.name.endsWith('.appimage'))?.asset ??
      lower.find((x) => x.name.endsWith('.deb'))?.asset
    );
  }

  return assets[0];
}
