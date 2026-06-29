// Upload routes — authenticated wallpaper submission. Accepts a single image
// file (multipart/form-data, field "image") plus metadata, queued for admin
// review. Mounted at /api/v1/uploads. Requires a valid user/admin token.
const express = require('express');
const multer = require('multer');
const router = express.Router();
const UploadController = require('../controllers/upload.controller');
const authorize = require('../middleware/authorize');

// In-memory storage — the buffer is handed to the service, which will persist
// it to local disk on the Hostinger VPS (image pipeline wired when configured).
const ALLOWED_MIME = ['image/jpeg', 'image/png'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error('Only JPEG and PNG images are allowed'));
  },
});

// Submit a new wallpaper for review (single image under field "image").
router.post('/', authorize(['user', 'admin']), upload.single('image'), UploadController.createUpload);

module.exports = router;
