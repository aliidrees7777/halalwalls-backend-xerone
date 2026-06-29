/**
 * Shared response + logging middleware for the HalalWalls backend.
 *
 * Replaces the external MS3001-Helper used by the reference architecture.
 * Every endpoint — success OR error — returns the SAME envelope shape:
 *
 *   {
 *     status:     'success' | 'error',
 *     statusCode: <http status>,
 *     message:    <human-readable>,
 *     data:       <payload> | null,
 *     service:    'halalwalls-backend',
 *     method:     <http method>,
 *     path:       <request path>,
 *     timestamp:  <ISO string>
 *   }
 */

// Attaches res.sendSuccess(message, data, statusCode) to every response.
const successHandler = (serviceName) => (req, res, next) => {
  res.sendSuccess = (message, data = null, statusCode = 200) => {
    return res.status(statusCode).json({
      status: 'success',
      statusCode,
      message: message || 'Request successful',
      data,
      service: serviceName,
      method: req.method,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  };
  next();
};

// Terminal error middleware — maps thrown errors (with optional .statusCode)
// to the standard envelope. Always last in the middleware chain.
const errorHandler = (serviceName) => (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  // Only a true, unhandled 500 hides its message (could leak internals).
  // Deliberate errors carrying their own statusCode (incl. 503 config
  // notices) surface their message to the client.
  const isUnhandled = !err.statusCode || statusCode === 500;
  if (statusCode >= 500) {
    console.error(`❌ [${serviceName}] ${req.method} ${req.originalUrl} -> ${statusCode}:`, err);
  } else {
    console.warn(`⚠️  [${serviceName}] ${req.method} ${req.originalUrl} -> ${statusCode}: ${err.message}`);
  }

  return res.status(statusCode).json({
    status: 'error',
    statusCode,
    message: isUnhandled ? 'Internal server error' : err.message,
    data: null,
    service: serviceName,
    method: req.method,
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
};

// Lightweight request logger — logs method, path, status and duration.
const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
};

module.exports = { successHandler, errorHandler, requestLogger };
