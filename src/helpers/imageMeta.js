/**
 * Image dimension reader — extracts the pixel width/height from a JPEG or PNG
 * buffer with no native or third-party dependency.
 *
 * The upload route only accepts image/jpeg and image/png (see upload.route.js),
 * so those two formats are all we need to parse. Returns { width, height } when
 * the dimensions can be determined, or null otherwise — the caller then falls
 * back to leaving width/height/resolution empty rather than guessing.
 */

// PNG: an 8-byte signature followed by the IHDR chunk, whose width and height
// are big-endian uint32s at byte offsets 16 and 20.
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readPng(buffer) {
  if (buffer.length < 24) return null;
  if (!buffer.subarray(0, 8).equals(PNG_SIG)) return null;
  // IHDR must be the first chunk; its 4-byte type tag sits at offset 12.
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

// JPEG: walk the marker segments until a Start-Of-Frame (SOFn) marker, which
// carries the frame's height/width as big-endian uint16s after a 1-byte sample
// precision field.
function readJpeg(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 1 < buffer.length) {
    // Markers are FF-prefixed; any run of padding FF bytes is skipped.
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    let marker = buffer[offset + 1];
    while (marker === 0xff && offset + 2 < buffer.length) {
      offset += 1;
      marker = buffer[offset + 1];
    }

    // Standalone markers with no length payload: SOI/EOI, TEM, RSTn.
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    if (offset + 4 > buffer.length) break;
    const length = buffer.readUInt16BE(offset + 2);

    // SOF0–SOF15 hold the dimensions — excluding DHT (C4), JPG (C8), DAC (CC).
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (offset + 9 > buffer.length) break;
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return { width, height };
    }

    offset += 2 + length; // jump past this segment to the next marker
  }
  return null;
}

// Detect the format from the leading magic bytes and dispatch. Returns
// { width, height } or null when the dimensions can't be read.
function readImageSize(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return readJpeg(buffer);
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return readPng(buffer);
  return null;
}

module.exports = { readImageSize };
