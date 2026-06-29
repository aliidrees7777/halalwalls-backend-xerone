// Contact controller — validates the inbound contact payload then delegates
// to ContactService. Validation failures short-circuit with a 400 via bad().
const ContactService = require('../services/contact.service');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Build a 400 error carrying its own statusCode (surfaced by errorHandler).
const bad = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

// POST /api/v1/contact
exports.submit = async (req, res, next) => {
  try {
    const { name, email, message } = req.body || {};

    if (!name || !email || !message) {
      return next(bad('Name, email and message are required'));
    }
    if (!EMAIL_REGEX.test(String(email))) {
      return next(bad('A valid email address is required'));
    }

    const response = await ContactService.submit(req.body);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};
