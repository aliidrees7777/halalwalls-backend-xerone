// Upload controller — validates that an image file is present, then hands the
// uploader's id, the file, and the body metadata to UploadService.
const UploadService = require('../services/upload.service');

// Build a 400 error carrying its own statusCode (surfaced by errorHandler).
const bad = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

// POST /api/v1/uploads
exports.createUpload = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(bad('An image file is required'));
    }

    // Absolute base URL for the stored image (e.g. http://localhost:3662).
    const origin = process.env.BACKEND_PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
    // Admins publish immediately (active, may set premium/live); users → pending.
    const isAdmin = req.user && req.user.role === 'admin';
    const response = await UploadService.createUpload(req.user.id, req.file, req.body, origin, {
      admin: isAdmin,
    });
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};
