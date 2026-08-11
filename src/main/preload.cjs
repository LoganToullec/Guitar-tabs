const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  exportPng: (dataUrl, defaultName) => ipcRenderer.invoke('export:png', { dataUrl, defaultName }),
  exportSvg: (svg, defaultName) => ipcRenderer.invoke('export:svg', { svg, defaultName }),
  copyPng: (dataUrl) => ipcRenderer.invoke('clipboard:png', { dataUrl }),
  saveProject: (json, defaultName) => ipcRenderer.invoke('project:save', { json, defaultName }),
  openProject: () => ipcRenderer.invoke('project:open'),
  searchLyrics: (query) => ipcRenderer.invoke('lyrics:search', { query }),
  loadLibrary: () => ipcRenderer.invoke('library:load'),
  saveLibrary: (json) => ipcRenderer.invoke('library:save', { json }),
});
