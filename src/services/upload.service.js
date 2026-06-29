// Upload service — handles uploaded wallpaper submissions: persists the image
// to local disk on the Hostinger VPS and creates a pending Wallpaper row for
// admin review. Structured stub for now; real logic implemented once the
// Hostinger storage credentials + image pipeline are configured.
// (Will use the Prisma client from ../lib/prisma once implemented.)

// Create a pending wallpaper from an uploaded file + metadata.
exports.createUpload = async (userId, file, body) => {
  // TODO: implement during API planning
  return {
    message: 'Upload received (stub — pending review)',
    data: { wallpaper: null },
    statusCode: 201,
  };
};
