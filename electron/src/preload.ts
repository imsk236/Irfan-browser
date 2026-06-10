import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("archive", {
  getBackendPort: (): Promise<number> => ipcRenderer.invoke("get-backend-port"),
});
