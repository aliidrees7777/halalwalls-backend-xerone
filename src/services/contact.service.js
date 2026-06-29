// Contact service — persists inbound "contact us" messages to the Contact
// table (status defaults to 'new'). Admins read/resolve these later from the
// (parked) admin surface or directly in the DB.
const prisma = require('../lib/prisma');

// Persist a submitted contact message. The controller has already validated
// that name, email (format) and message are present.
exports.submit = async (payload = {}) => {
  const { name, email, reason, message } = payload;

  const contact = await prisma.contact.create({
    data: {
      name: String(name).trim(),
      email: String(email).toLowerCase().trim(),
      reason: reason ? String(reason).trim() : null,
      message: String(message).trim(),
    },
  });

  return {
    message: "Thanks! Your message has been received — we'll get back to you soon.",
    data: { id: String(contact.id), status: contact.status },
    statusCode: 201,
  };
};
