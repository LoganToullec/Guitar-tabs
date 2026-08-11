/**
 * Rasterises build/icon.svg with Electron's renderer, then assembles the platform
 * icon containers (.ico for Windows, .icns for macOS) plus a 1024px .png fallback.
 *
 * Run with: npm run icons
 */
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const BUILD_DIR = path.join(__dirname, '..', 'build');
const SOURCE = path.join(BUILD_DIR, 'icon.svg');
const SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const ICNS_TYPES = { 16: 'icp4', 32: 'icp5', 64: 'icp6', 128: 'ic07', 256: 'ic08', 512: 'ic09', 1024: 'ic10' };

const ICO_HEADER_BYTES = 6;
const ICO_ENTRY_BYTES = 16;
const ICNS_CHUNK_HEADER_BYTES = 8;

const RENDER_PAGE = `<!doctype html><meta charset="utf-8"><body><script>
  window.renderSizes = (svg, sizes) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const image = new Image();
    image.onload = () => {
      const out = sizes.map((size) => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        canvas.getContext('2d').drawImage(image, 0, 0, size, size);
        return canvas.toDataURL('image/png');
      });
      URL.revokeObjectURL(url);
      resolve(out);
    };
    image.onerror = () => reject(new Error('SVG illisible'));
    image.src = url;
  });
</script></body>`;

/** ICO container holding PNG-encoded images (Vista+ format). */
const buildIco = (images) => {
  const header = Buffer.alloc(ICO_HEADER_BYTES);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(ICO_ENTRY_BYTES * images.length);
  let offset = ICO_HEADER_BYTES + directory.length;

  images.forEach((image, index) => {
    const at = index * ICO_ENTRY_BYTES;
    const dimension = image.size >= 256 ? 0 : image.size; // 0 means 256 in the ICO spec
    directory.writeUInt8(dimension, at);
    directory.writeUInt8(dimension, at + 1);
    directory.writeUInt16LE(1, at + 4);
    directory.writeUInt16LE(32, at + 6);
    directory.writeUInt32LE(image.buffer.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += image.buffer.length;
  });

  return Buffer.concat([header, directory, ...images.map((image) => image.buffer)]);
};

/** ICNS container: 'icns' magic, total length, then one typed chunk per size. */
const buildIcns = (images) => {
  const chunks = images
    .filter((image) => ICNS_TYPES[image.size])
    .map((image) => {
      const head = Buffer.alloc(ICNS_CHUNK_HEADER_BYTES);
      head.write(ICNS_TYPES[image.size], 0, 4, 'ascii');
      head.writeUInt32BE(image.buffer.length + ICNS_CHUNK_HEADER_BYTES, 4);
      return Buffer.concat([head, image.buffer]);
    });

  const body = Buffer.concat(chunks);
  const head = Buffer.alloc(ICNS_CHUNK_HEADER_BYTES);
  head.write('icns', 0, 4, 'ascii');
  head.writeUInt32BE(body.length + ICNS_CHUNK_HEADER_BYTES, 4);
  return Buffer.concat([head, body]);
};

const rasterise = async (svg) => {
  const pagePath = path.join(os.tmpdir(), `guitartabs-icon-${process.pid}.html`);
  await fs.writeFile(pagePath, RENDER_PAGE, 'utf8');

  const window = new BrowserWindow({ show: false, width: 1200, height: 1200 });
  try {
    await window.loadFile(pagePath);
    const dataUrls = await window.webContents.executeJavaScript(
      `window.renderSizes(${JSON.stringify(svg)}, ${JSON.stringify(SIZES)})`,
    );
    return SIZES.map((size, index) => ({
      size,
      buffer: Buffer.from(dataUrls[index].slice(dataUrls[index].indexOf(',') + 1), 'base64'),
    }));
  } finally {
    window.destroy();
    await fs.rm(pagePath, { force: true });
  }
};

const generate = async () => {
  const images = await rasterise(await fs.readFile(SOURCE, 'utf8'));
  const bySize = new Map(images.map((image) => [image.size, image]));
  const pick = (sizes) => sizes.map((size) => bySize.get(size)).filter(Boolean);

  const outputs = [
    ['icon.png', bySize.get(1024).buffer],
    ['icon.ico', buildIco(pick(ICO_SIZES))],
    ['icon.icns', buildIcns(pick(Object.keys(ICNS_TYPES).map(Number)))],
  ];

  const report = [];
  for (const [name, buffer] of outputs) {
    await fs.writeFile(path.join(BUILD_DIR, name), buffer);
    report.push(`build/${name.padEnd(10)} ${(buffer.length / 1024).toFixed(1)} Ko`);
  }
  return report.join('\n');
};

// The offscreen window is destroyed halfway through; without this the default
// window-all-closed handler would quit before the icons are written.
app.on('window-all-closed', () => {});

// Electron's main process has no console attached on Windows, so the summary goes
// to a file next to the icons and failures are left uncaught (Node prints those).
app.whenReady().then(async () => {
  const summary = await generate();
  await fs.writeFile(path.join(BUILD_DIR, 'icons.log'), `${summary}\n`, 'utf8');
  app.exit(0);
});
