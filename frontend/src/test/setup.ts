import "@testing-library/jest-dom";

// Stub the Electron IPC bridge so component tests don't fail on window.archive
(window as any).archive = {
  getBackendPort: async () => 8765,
  openDirectory: async () => null,
  savePdf: async () => null,
  exportPdf: async () => ({ file: "" }),
};
