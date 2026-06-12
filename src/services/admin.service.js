// Admin service — moderation business logic: list the pending wallpaper queue,
// approve/reject submissions (updating Wallpaper status), and list inbound
// Contact messages. Structured stubs; real logic implemented during API planning.
const Wallpaper = require('../models/wallpaper.schema');
const Contact = require('../models/contact.schema');

// Wallpapers awaiting moderation.
exports.listPending = async (query) => {
  // TODO: implement during API planning
  return {
    message: 'Pending wallpapers (stub — not yet implemented)',
    data: { wallpapers: [] },
    statusCode: 200,
  };
};

// Approve a pending wallpaper.
exports.approve = async (id, body) => {
  // TODO: implement during API planning
  return {
    message: 'Wallpaper approved (stub — not yet implemented)',
    data: { wallpaper: null },
    statusCode: 200,
  };
};

// Reject a pending wallpaper.
exports.reject = async (id, body) => {
  // TODO: implement during API planning
  return {
    message: 'Wallpaper rejected (stub — not yet implemented)',
    data: { wallpaper: null },
    statusCode: 200,
  };
};

// List inbound contact messages.
exports.listContacts = async (query) => {
  // TODO: implement during API planning
  return {
    message: 'Contact messages (stub — not yet implemented)',
    data: { contacts: [] },
    statusCode: 200,
  };
};
