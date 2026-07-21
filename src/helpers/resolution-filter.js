/**
 * Standard download catalog (3 desktop + 3 mobile) and helpers that only keep
 * sizes the source image can cover without upscaling.
 *
 * Rule: offer a target size only when targetWidth ≤ sourceWidth AND
 * targetHeight ≤ sourceHeight. Same size is allowed; larger in either
 * dimension is not.
 */

/** The six sizes we offer site-wide. */
const STANDARD_DOWNLOAD_RESOLUTIONS = [
  { label: '1920×1080', key: '1920x1080', width: 1920, height: 1080, fileSizeMB: 1.42, device: 'desktop', quality: 'full-hd', display: 'Full HD' },
  { label: '2560×1440', key: '2560x1440', width: 2560, height: 1440, fileSizeMB: 2.18, device: 'desktop', quality: '2k', display: '2K' },
  { label: '3840×2160', key: '3840x2160', width: 3840, height: 2160, fileSizeMB: 4.86, device: 'desktop', quality: '4k', display: '4K' },
  { label: '1080×2400', key: '1080x2400', width: 1080, height: 2400, fileSizeMB: 1.64, device: 'mobile', quality: 'mobile-hd', display: '1080×2400' },
  { label: '1290×2796', key: '1290x2796', width: 1290, height: 2796, fileSizeMB: 1.92, device: 'mobile', quality: 'mobile-2k', display: '1290×2796' },
  { label: '1320×2868', key: '1320x2868', width: 1320, height: 2868, fileSizeMB: 2.04, device: 'mobile', quality: 'mobile-pro', display: '1320×2868' },
];

function fitsSource(targetW, targetH, sourceW, sourceH) {
  const sw = Number(sourceW) || 0;
  const sh = Number(sourceH) || 0;
  if (!sw || !sh) return false;
  return targetW <= sw && targetH <= sh;
}

/** Keys like `1920x1080` for Wallpaper.resolutions (same + below only). */
function resolutionKeysForSource(sourceW, sourceH) {
  return STANDARD_DOWNLOAD_RESOLUTIONS
    .filter((r) => fitsSource(r.width, r.height, sourceW, sourceH))
    .map((r) => r.key);
}

/**
 * Largest desktop standard size that fits the source (4K → 2K → Full HD).
 * Used for the primary "Download Wallpaper" button — never the native size.
 */
function preferredResolutionForSource(sourceW, sourceH) {
  const desktop = STANDARD_DOWNLOAD_RESOLUTIONS
    .filter((r) => r.device === 'desktop' && fitsSource(r.width, r.height, sourceW, sourceH))
    .sort((a, b) => b.width - a.width);
  return desktop[0]?.key || null;
}

/** Human label for the primary download button (4K / 2K / Full HD). */
function preferredDisplayLabel(key) {
  const hit = STANDARD_DOWNLOAD_RESOLUTIONS.find((r) => r.key === key);
  return hit?.display || key || '';
}

/** Filename quality segment: 4k | 2k | full-hd | original | WxH */
function qualityLabelForDownload(width, height, isOriginal) {
  if (isOriginal) return 'original';
  const hit = STANDARD_DOWNLOAD_RESOLUTIONS.find(
    (r) => r.width === width && r.height === height,
  );
  if (hit) return hit.quality;
  return `${width}x${height}`;
}

/** Catalog split for the detail page download panel. */
function downloadCatalogForSource(sourceW, sourceH) {
  const available = STANDARD_DOWNLOAD_RESOLUTIONS.filter((r) =>
    fitsSource(r.width, r.height, sourceW, sourceH),
  );
  return {
    desktop: available
      .filter((r) => r.device === 'desktop')
      .map(({ label, width, height, fileSizeMB, device }) => ({
        label, width, height, fileSizeMB, device,
      })),
    mobile: available
      .filter((r) => r.device === 'mobile')
      .map(({ label, width, height, fileSizeMB, device }) => ({
        label, width, height, fileSizeMB, device,
      })),
  };
}

/** True when a requested download size would require upscaling. */
function wouldUpscale(targetW, targetH, sourceW, sourceH) {
  const sw = Number(sourceW) || 0;
  const sh = Number(sourceH) || 0;
  if (!sw || !sh || !targetW || !targetH) return false;
  return targetW > sw || targetH > sh;
}

module.exports = {
  STANDARD_DOWNLOAD_RESOLUTIONS,
  fitsSource,
  resolutionKeysForSource,
  preferredResolutionForSource,
  preferredDisplayLabel,
  qualityLabelForDownload,
  downloadCatalogForSource,
  wouldUpscale,
};
