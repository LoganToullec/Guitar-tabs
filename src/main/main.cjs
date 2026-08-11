// CommonJS on purpose: inside Electron only `require('electron')` resolves to the
// built-in API — an ESM `import` would pick up the npm launcher shim instead.
const { app, BrowserWindow, ipcMain, dialog, protocol, net, clipboard, nativeImage } = require('electron');
const { readFile, writeFile, rename } = require('node:fs/promises');
const path = require('node:path');

const RENDERER_DIR = path.join(__dirname, '..', 'renderer');
const APP_SCHEME = 'app';
const APP_ORIGIN = `${APP_SCHEME}://guitartabs`;
const WINDOW_DEFAULTS = { width: 1320, height: 860, minWidth: 1080, minHeight: 680 };

/** LRCLIB is a free, open community lyrics database and asks callers to identify themselves. */
const LYRICS_API = 'https://lrclib.net/api';
const LYRICS_AGENT = `GuitarTabs/${require('../../package.json').version} (desktop chord sheet editor)`;
const LYRICS_TIMEOUT_MS = 9000;
const MAX_LYRICS_RESULTS = 20;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
};

protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

/**
 * Serves the renderer over a custom standard scheme so ES modules load with a
 * real origin (file:// gives an opaque origin and blocks module imports).
 * Files are read through fs so the handler also works inside the packaged asar.
 */
const handleAppProtocol = async (request) => {
  const requestedPath = decodeURIComponent(new URL(request.url).pathname);
  const target = path.join(RENDERER_DIR, requestedPath);
  const relative = path.relative(RENDERER_DIR, target);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const body = await readFile(target);
    const type = MIME_TYPES[path.extname(target).toLowerCase()] ?? 'application/octet-stream';
    return new Response(body, { headers: { 'content-type': type } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
};

const createWindow = () => {
  const window = new BrowserWindow({
    ...WINDOW_DEFAULTS,
    backgroundColor: '#14161c',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.loadURL(`${APP_ORIGIN}/index.html`);
  return window;
};

const dataUrlToBuffer = (dataUrl) => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');

const ownerWindow = (event) => BrowserWindow.fromWebContents(event.sender);

const saveWithDialog = async (event, { defaultName, filters, write }) => {
  const window = ownerWindow(event);
  const { canceled, filePath } = await dialog.showSaveDialog(window, { defaultPath: defaultName, filters });

  if (canceled || !filePath) return { ok: false, canceled: true };

  try {
    await write(filePath);
    return { ok: true, filePath };
  } catch (error) {
    return { ok: false, error: error.message };
  }
};

/** The library lives in the per-user app data folder, outside the portable executable. */
const libraryPath = () => path.join(app.getPath('userData'), 'library.json');

const requestJson = async (url) => {
  const response = await net.fetch(url, {
    headers: { 'User-Agent': LYRICS_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(LYRICS_TIMEOUT_MS),
  });
  return response.ok ? response.json() : null;
};

/**
 * Free-text lookup on LRCLIB, returning every match so the user picks the right one.
 * Only the words typed in the search box leave the machine.
 */
const searchLyrics = async (query) => {
  const wanted = String(query ?? '').trim();
  if (wanted === '') return { ok: false, error: 'Saisissez un artiste ou un titre.' };

  try {
    const found = await requestJson(`${LYRICS_API}/search?${new URLSearchParams({ q: wanted })}`);
    const results = (Array.isArray(found) ? found : [])
      .filter((entry) => typeof entry?.plainLyrics === 'string' && entry.plainLyrics.trim() !== '')
      .slice(0, MAX_LYRICS_RESULTS)
      .map((entry) => ({
        track: entry.trackName ?? '',
        artist: entry.artistName ?? '',
        album: entry.albumName ?? '',
        duration: Number(entry.duration) || 0,
        lyrics: entry.plainLyrics,
      }));

    return results.length === 0
      ? { ok: false, error: 'Aucun résultat pour cette recherche.' }
      : { ok: true, results };
  } catch (error) {
    return { ok: false, error: `Recherche impossible : ${error.message}` };
  }
};

const registerIpcHandlers = () => {
  ipcMain.handle('export:png', (event, { dataUrl, defaultName }) =>
    saveWithDialog(event, {
      defaultName,
      filters: [{ name: 'Image PNG', extensions: ['png'] }],
      write: (filePath) => writeFile(filePath, dataUrlToBuffer(dataUrl)),
    }),
  );

  ipcMain.handle('export:svg', (event, { svg, defaultName }) =>
    saveWithDialog(event, {
      defaultName,
      filters: [{ name: 'Image SVG', extensions: ['svg'] }],
      write: (filePath) => writeFile(filePath, svg, 'utf8'),
    }),
  );

  ipcMain.handle('project:save', (event, { json, defaultName }) =>
    saveWithDialog(event, {
      defaultName,
      filters: [{ name: 'Accord GuitarTabs', extensions: ['gtab', 'json'] }],
      write: (filePath) => writeFile(filePath, json, 'utf8'),
    }),
  );

  ipcMain.handle('project:open', async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(ownerWindow(event), {
      properties: ['openFile'],
      filters: [{ name: 'Accord GuitarTabs', extensions: ['gtab', 'json'] }],
    });

    if (canceled || filePaths.length === 0) return { ok: false, canceled: true };

    try {
      return { ok: true, json: await readFile(filePaths[0], 'utf8'), filePath: filePaths[0] };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('lyrics:search', (_event, { query }) => searchLyrics(query));

  ipcMain.handle('library:load', async () => {
    try {
      return { ok: true, json: await readFile(libraryPath(), 'utf8') };
    } catch (error) {
      // A missing file simply means the library has never been written yet.
      return error.code === 'ENOENT' ? { ok: true, json: null } : { ok: false, error: error.message };
    }
  });

  ipcMain.handle('library:save', async (_event, { json }) => {
    const target = libraryPath();
    try {
      // Write beside the target and swap, so an interrupted save cannot truncate it.
      await writeFile(`${target}.tmp`, json, 'utf8');
      await rename(`${target}.tmp`, target);
      return { ok: true, path: target };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('clipboard:png', (_event, { dataUrl }) => {
    try {
      clipboard.writeImage(nativeImage.createFromDataURL(dataUrl));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
};

app.whenReady().then(() => {
  protocol.handle(APP_SCHEME, handleAppProtocol);
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
