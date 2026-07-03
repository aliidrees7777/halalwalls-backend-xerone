// Resolution controller — public "browse by resolution" set, now data-driven
// from the admin-managed Resolution catalog (active resolutions only).
const ResolutionService = require('../services/resolution.service');

// GET /api/v1/resolutions
exports.list = async (req, res, next) => {
  try {
    const response = await ResolutionService.listPublic();
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};
