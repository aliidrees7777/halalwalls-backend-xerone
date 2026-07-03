// Resolution controller — serves the fixed "browse by resolution" set the
// client approved for now (image-2). Static; no DB. If this needs to become
// data-driven later, swap to a service + model without changing the route.
const RESOLUTIONS = {
  desktop: ['1920×1080', '2560×1440', '3840×2160'],
  mobile: ['1080×2400', '1290×2796', '1320×2868'],
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
