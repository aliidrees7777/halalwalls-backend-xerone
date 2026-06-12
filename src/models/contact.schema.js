const mongoose = require('mongoose');

const ContactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      validate: {
        validator: (v) => /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/.test(v),
        message: 'Please enter a valid email',
      },
    },
    reason: { type: String },
    message: { type: String, required: true },
    status: { type: String, enum: ['new', 'read', 'resolved'], default: 'new', index: true },

    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'hw_contacts' }
);

module.exports = mongoose.model('Contact', ContactSchema);
