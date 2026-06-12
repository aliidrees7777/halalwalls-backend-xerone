// Upload service — handles uploaded wallpaper submissions: pushes the image
// buffer to object storage and creates a pending Wallpaper document for admin
// review. Structured stub for now; real logic implemented during API planning.
const Wallpaper = require('../models/wallpaper.schema');

// Create a pending wallpaper from an uploaded file + metadata.
exports.createUpload = async (userId, file, body) => {
  // TODO: implement during API planning
  return {
    message: 'Upload received (stub — pending review)',
    data: { wallpaper: null },
    statusCode: 201,
  };
};
