// Resolution controller — fixed 3 desktop + 3 mobile catalog (image-2).
// Includes a `list` with width/height so clients can filter by source size.
const LIST = [
  { label: '1920×1080', width: 1920, height: 1080, fileSizeMB: 1.42, device: 'desktop' },
  { label: '2560×1440', width: 2560, height: 1440, fileSizeMB: 2.18, device: 'desktop' },
  { label: '3840×2160', width: 3840, height: 2160, fileSizeMB: 4.86, device: 'desktop' },
  { label: '1080×2400', width: 1080, height: 2400, fileSizeMB: 1.64, device: 'mobile' },
  { label: '1290×2796', width: 1290, height: 2796, fileSizeMB: 1.92, device: 'mobile' },
  { label: '1320×2868', width: 1320, height: 2868, fileSizeMB: 2.04, device: 'mobile' },
];

const RESOLUTIONS = {
  desktop: LIST.filter((r) => r.device === 'desktop').map((r) => r.label),
  mobile: LIST.filter((r) => r.device === 'mobile').map((r) => r.label),
  list: LIST,
};

// GET /api/v1/resolutions
exports.list = async (req, res, next) => {
  try {
    res.sendSuccess('Resolutions fetched', RESOLUTIONS, 200);
  } catch (error) {
    next(error);
  }
};

exports.RESOLUTIONS = RESOLUTIONS;
