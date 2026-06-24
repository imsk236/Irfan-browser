import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("archive", {
  getBackendPort: (): Promise<number> =>
    ipcRenderer.invoke("get-backend-port"),

  openDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke("dialog:open-directory"),

  savePdf: (): Promise<string | null> =>
    ipcRenderer.invoke("dialog:save-pdf"),

  exportPdf: (outputPath: string, researcher: string): Promise<{ file: string }> =>
    ipcRenderer.invoke("export:pdf", { outputPath, researcher }),
});
