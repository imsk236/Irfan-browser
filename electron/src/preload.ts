import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("archive", {
  getBackendPort: (): Promise<number> =>
    ipcRenderer.invoke("get-backend-port"),

  openDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke("dialog:open-directory"),

  getDbPath: (): Promise<string> => ipcRenderer.invoke("db:get-path"),

  chooseDbLocation: (): Promise<
    | { status: "unchanged" | "adopt" | "new"; path: string }
    | { status: "conflict"; path: string; foundPath: string }
    | null
  > => ipcRenderer.invoke("db:choose-location"),

  confirmDbLocation: (targetPath: string): Promise<void> =>
    ipcRenderer.invoke("db:confirm-location", targetPath),

  restartApp: (): Promise<void> => ipcRenderer.invoke("app:restart"),

  savePdf: (): Promise<string | null> =>
    ipcRenderer.invoke("dialog:save-pdf"),

  exportPdf: (outputPath: string, researcher: string): Promise<{ file: string }> =>
    ipcRenderer.invoke("export:pdf", { outputPath, researcher }),

  onUpdateAvailable: (cb: (info: { version: string }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, info: { version: string }) => cb(info);
    ipcRenderer.on("update:available", handler);
    return () => ipcRenderer.removeListener("update:available", handler);
  },

  onUpdateProgress: (cb: (info: { percent: number }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, info: { percent: number }) => cb(info);
    ipcRenderer.on("update:progress", handler);
    return () => ipcRenderer.removeListener("update:progress", handler);
  },

  onUpdateDownloaded: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on("update:downloaded", handler);
    return () => ipcRenderer.removeListener("update:downloaded", handler);
  },

  downloadUpdate: (): Promise<void> => ipcRenderer.invoke("update:download"),
  installUpdate: (): Promise<void> => ipcRenderer.invoke("update:install"),
});
