const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bds", {
  pickFiles: (opts) => ipcRenderer.invoke("pick-files", opts),
  pickFolder: (opts) => ipcRenderer.invoke("pick-folder", opts),
});
