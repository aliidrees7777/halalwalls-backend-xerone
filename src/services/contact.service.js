// Contact service — persists inbound "contact us" messages to the Contact
// model (status defaults to 'new'). Admins read/resolve these later from the
// (parked) admin surface or directly in the DB.
const Contact = require('../models/contact.schema');

// Persist a submitted contact message. The controller has already validated
// that name, email (format) and message are present.
exports.submit = async (payload = {}) => {
  const { name, email, reason, message } = payload;

  const contact = await Contact.create({
    name: String(name).trim(),
    email: String(email).toLowerCase().trim(),
    reason: reason ? String(reason).trim() : undefined,
    message: String(message).trim(),
  });

  return {
    message: "Thanks! Your message has been received — we'll get back to you soon.",
    data: { id: String(contact._id), status: contact.status },
    statusCode: 201,
  };
};
