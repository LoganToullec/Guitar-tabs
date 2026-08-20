import test from 'node:test';
import assert from 'node:assert/strict';

import { withPixelDensity } from '../src/renderer/js/png-density.js';

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const bytes = new Uint8Array(data.length + 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, data.length);
  bytes.set([...type].map((character) => character.charCodeAt(0)), 4);
  bytes.set(data, 8);
  view.setUint32(8 + data.length, crc32(bytes.subarray(4, 8 + data.length)));
  return bytes;
};

const concat = (parts) => {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
};

const toDataUrl = (bytes) =>
  `data:image/png;base64,${btoa(String.fromCharCode(...bytes))}`;

const fromDataUrl = (dataUrl) =>
  Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(',') + 1)), (character) => character.charCodeAt(0));

/** Walks the chunk list of a PNG, the way a reader would. */
const chunksOf = (bytes) => {
  const out = [];
  let offset = 8;

  while (offset + 12 <= bytes.length) {
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    const crc = view.getUint32(offset + 8 + length);

    out.push({ type, data, crc, crcValid: crc === crc32(bytes.subarray(offset + 4, offset + 8 + length)) });
    offset += length + 12;
    if (type === 'IEND') break;
  }
  return out;
};

const header = () => chunk('IHDR', new Uint8Array(13));
const pixels = () => chunk('IDAT', Uint8Array.from([1, 2, 3, 4]));
const end = () => chunk('IEND', new Uint8Array(0));

const samplePng = (extra = []) => toDataUrl(concat([Uint8Array.from(SIGNATURE), header(), ...extra, pixels(), end()]));

test('la densité est écrite juste après l en-tête', () => {
  // Arrange
  const png = samplePng();

  // Act
  const chunks = chunksOf(fromDataUrl(withPixelDensity(png, 960)));

  // Assert
  assert.deepEqual(chunks.map((entry) => entry.type), ['IHDR', 'pHYs', 'IDAT', 'IEND']);
});

test('960 dpi devient 37795 pixels par mètre sur les deux axes', () => {
  // Arrange
  const png = samplePng();

  // Act
  const phys = chunksOf(fromDataUrl(withPixelDensity(png, 960))).find((entry) => entry.type === 'pHYs');

  // Assert
  const view = new DataView(phys.data.buffer, phys.data.byteOffset);
  assert.equal(view.getUint32(0), 37795);
  assert.equal(view.getUint32(4), 37795);
  assert.equal(phys.data[8], 1, 'unité = mètre');
});

test('le chunk ajouté porte un CRC valide', () => {
  // Arrange
  const png = samplePng();

  // Act
  const chunks = chunksOf(fromDataUrl(withPixelDensity(png, 384)));

  // Assert
  assert.ok(chunks.every((entry) => entry.crcValid), 'tous les chunks restent lisibles');
});

test('une densité déjà présente est remplacée, pas doublée', () => {
  // Arrange
  const existing = chunk('pHYs', Uint8Array.from([0, 0, 0x0e, 0xc4, 0, 0, 0x0e, 0xc4, 1]));
  const png = samplePng([existing]);

  // Act
  const chunks = chunksOf(fromDataUrl(withPixelDensity(png, 960)));

  // Assert
  assert.equal(chunks.filter((entry) => entry.type === 'pHYs').length, 1);
  assert.deepEqual(chunks.map((entry) => entry.type), ['IHDR', 'pHYs', 'IDAT', 'IEND']);
});

test('les données d image ne sont pas touchées', () => {
  // Arrange
  const png = samplePng();

  // Act
  const data = chunksOf(fromDataUrl(withPixelDensity(png, 960))).find((entry) => entry.type === 'IDAT').data;

  // Assert
  assert.deepEqual([...data], [1, 2, 3, 4]);
});

test('une densité nulle ou absurde laisse le PNG intact', () => {
  // Arrange
  const png = samplePng();

  // Act & Assert
  assert.equal(withPixelDensity(png, 0), png);
  assert.equal(withPixelDensity(png, -5), png);
  assert.equal(withPixelDensity(png, Number.NaN), png);
});

test('un data URL qui n est pas un PNG est renvoyé tel quel', () => {
  // Arrange
  const jpeg = 'data:image/jpeg;base64,AAAA';

  // Act & Assert
  assert.equal(withPixelDensity(jpeg, 960), jpeg);
});
