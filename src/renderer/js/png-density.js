/**
 * Stamps an exported PNG with the physical resolution it is meant to be printed at.
 *
 * A canvas PNG carries no `pHYs` chunk, so Word and friends fall back to 96 dpi: a chord
 * diagram rendered at 4× then lands on the page eight inches wide and has to be resized by
 * hand every single time. Writing the density we actually drew at makes the image insert
 * at the size of a printed chord chart straight away.
 */

const SIGNATURE_LENGTH = 8;
const CHUNK_OVERHEAD = 12; // 4 bytes length + 4 bytes type + 4 bytes CRC
const PHYS_LENGTH = 9; // pixels per unit on x and y, then the unit byte
const METRE_UNIT = 1;
const METRES_PER_INCH = 0.0254;
const BASE64_CHUNK = 0x8000; // String.fromCharCode chokes on very long argument lists

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const bytesFromBase64 = (base64) => {
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const base64FromBytes = (bytes) => {
  let binary = '';
  for (let start = 0; start < bytes.length; start += BASE64_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(start, start + BASE64_CHUNK));
  }
  return btoa(binary);
};

const readUint32 = (bytes, offset) =>
  ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;

const readType = (bytes, offset) =>
  String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);

/** @returns {Uint8Array} a complete `pHYs` chunk, header and CRC included */
const physChunk = (pixelsPerMetre) => {
  const chunk = new Uint8Array(PHYS_LENGTH + CHUNK_OVERHEAD);
  const view = new DataView(chunk.buffer);

  view.setUint32(0, PHYS_LENGTH);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // 'pHYs'
  view.setUint32(8, pixelsPerMetre);
  view.setUint32(12, pixelsPerMetre);
  chunk[16] = METRE_UNIT;
  view.setUint32(17, crc32(chunk.subarray(4, 17)));

  return chunk;
};

/**
 * Rewrites the PNG so its `pHYs` chunk announces `dpi`, dropping any existing one. The
 * chunk goes right after `IHDR`, which the spec requires it to follow and precede `IDAT`.
 */
const withPhysChunk = (bytes, dpi) => {
  const chunk = physChunk(Math.round(dpi / METRES_PER_INCH));
  const pieces = [bytes.subarray(0, SIGNATURE_LENGTH)];
  let offset = SIGNATURE_LENGTH;
  let afterHeader = false;

  while (offset + CHUNK_OVERHEAD <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = readType(bytes, offset);
    const end = offset + length + CHUNK_OVERHEAD;

    if (type !== 'pHYs') pieces.push(bytes.subarray(offset, end));
    if (type === 'IHDR') {
      pieces.push(chunk);
      afterHeader = true;
    }

    offset = end;
    if (type === 'IEND') break;
  }

  if (!afterHeader) return bytes;

  const total = pieces.reduce((sum, piece) => sum + piece.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const piece of pieces) {
    out.set(piece, cursor);
    cursor += piece.length;
  }
  return out;
};

/**
 * @param {string} dataUrl a `data:image/png;base64,…` URL
 * @param {number} dpi dots per inch to declare; a non-positive value leaves the PNG alone
 * @returns {string} the same kind of data URL, with the density written in
 */
export const withPixelDensity = (dataUrl, dpi) => {
  const separator = dataUrl.indexOf(',');
  if (!(dpi > 0) || separator < 0 || !dataUrl.startsWith('data:image/png;base64,')) return dataUrl;

  const stamped = withPhysChunk(bytesFromBase64(dataUrl.slice(separator + 1)), dpi);
  return `${dataUrl.slice(0, separator + 1)}${base64FromBytes(stamped)}`;
};
