// Stats controller — thin HTTP layer for public aggregate stats.
// Delegates to StatsService and emits res.sendSuccess(...).
const StatsService = require('../services/stats.service');

// GET /api/v1/stats
exports.getPublicStats = async (req, res, next) => {
  try {
    const response = await StatsService.getPublicStats(req.query);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};
