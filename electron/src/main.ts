import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { writeFile, copyFile } from "fs/promises";

const isDev = !app.isPackaged;
let backendProcess: ChildProcess | null = null;
let backendPort = 0;
let mainWindow: BrowserWindow | null = null;

/**
 * Spawn the Python FastAPI backend.
 *
 * The backend performs the WAL lock check itself and prints either:
 *   BACKEND_PORT=<n>  — started successfully
 *   BACKEND_LOCKED    — the database file is locked by another process
 */
function startBackend(dbPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const args = ["--db", dbPath];
    let child: ChildProcess;

    if (isDev) {
      const backendDir = path.join(__dirname, "..", "..", "backend");
      // Augment PATH so uv is found even when installed in ~/.local/bin (not in system PATH)
      const localBin = path.join(
        process.env.USERPROFILE ?? process.env.HOME ?? "",
        ".local",
        "bin"
      );
      const spawnEnv = {
        ...process.env,
        PATH: `${localBin}${path.delimiter}${process.env.PATH ?? ""}`,
      };
      child = spawn("uv", ["run", "python", "-m", "src.main", ...args], {
        cwd: backendDir,
        env: spawnEnv,
      });
    } else {
      const backendExe = path.join(
        (process as any).resourcesPath as string,
        "backend",
        "backend.exe"
      );
      child = spawn(backendExe, args);
    }

    backendProcess = child;
    let resolved = false;

    child.stdout?.on("data", (data: Buffer) => {
      const text = data.toString();

      if (text.includes("BACKEND_LOCKED") && !resolved) {
        resolved = true;
        child.kill();
        reject(new Error("LOCKED"));
        return;
      }

      const match = text.match(/BACKEND_PORT=(\d+)/);
      if (match && !resolved) {
        resolved = true;
        resolve(parseInt(match[1], 10));
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      if (!resolved) console.error("[backend]", data.toString());
    });

    child.on("error", (err) => { if (!resolved) { resolved = true; reject(err); } });
    child.on("exit", (code) => {
      if (!resolved) { resolved = true; reject(new Error(`Backend exited with code ${code}`)); }
    });

    setTimeout(() => {
      if (!resolved) { resolved = true; reject(new Error("Backend startup timeout")); }
    }, 30000);
  });
}

function createWindow(port: number) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#F7F5EF",
    icon: isDev
      ? path.join(__dirname, "..", "..", "frontend", "public", "irfan_logo.png")
      : path.join((process as any).resourcesPath as string, "frontend", "dist", "irfan_logo.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: "أرشيف عرفان للمخطوطات",
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(
      path.join(
        (process as any).resourcesPath as string,
        "frontend",
        "dist",
        "index.html"
      )
    );
  }

  mainWindow.on("closed", () => { mainWindow = null; });
}

ipcMain.handle("get-backend-port", () => backendPort);

ipcMain.handle("dialog:open-directory", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"],
    title: "اختر مجلد التصدير",
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("dialog:save-pdf", async () => {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const time = `${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;
  const result = await dialog.showSaveDialog({
    title: "حفظ ملف PDF",
    defaultPath: `ارشيف_عرفان_${date}_${time}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle("export:pdf", async (_, { outputPath, researcher }: { outputPath: string; researcher: string }) => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  try {
    const url = `http://localhost:${backendPort}/export/pdf-html?researcher=${encodeURIComponent(researcher || "")}`;
    await win.loadURL(url);
    // Wait for fonts (Google Fonts) to finish loading
    await win.webContents.executeJavaScript("document.fonts.ready");
    const pdfData = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: "A4",
      landscape: false,
    });
    await writeFile(outputPath, pdfData);
    return { file: outputPath };
  } finally {
    win.close();
  }
});

app.whenReady().then(async () => {
  const dbPath = path.join(app.getPath("userData"), "archive.db");

  // On first launch in production, copy the bundled seed database to userData.
  if (!isDev && !fs.existsSync(dbPath)) {
    const bundledDb = path.join(
      (process as any).resourcesPath as string,
      "archive.db"
    );
    if (fs.existsSync(bundledDb)) {
      await copyFile(bundledDb, dbPath);
    }
  }

  try {
    backendPort = await startBackend(dbPath);
  } catch (err) {
    const isLocked = err instanceof Error && err.message === "LOCKED";

    if (isLocked) {
      const choice = dialog.showMessageBoxSync({
        type: "warning",
        title: "قاعدة البيانات مقفلة",
        message: "يبدو أن البرنامج مفتوح على جهاز آخر أو لم يُغلق بشكل صحيح.",
        detail: "أغلق النسخة الأخرى ثم حاول مجدداً.",
        buttons: ["إعادة المحاولة", "إغلاق البرنامج"],
        defaultId: 0,
        cancelId: 1,
      });
      if (choice === 1) { app.quit(); return; }
      // retry once
      try {
        backendPort = await startBackend(dbPath);
      } catch {
        dialog.showErrorBox("فشل تشغيل البرنامج", "تعذّر الاتصال بقاعدة البيانات. أعد المحاولة لاحقاً.");
        app.quit();
        return;
      }
    } else {
      dialog.showErrorBox("فشل تشغيل الخدمة الخلفية", String(err));
      app.quit();
      return;
    }
  }

  createWindow(backendPort);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
});
