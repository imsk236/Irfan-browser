import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { spawn, ChildProcess } from "child_process";
import * as path from "path";

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
      const backendExe = path.join((process as any).resourcesPath as string, "backend.exe");
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
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: "أرشيف إرفان للمخطوطات",
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(
      path.join(__dirname, "..", "..", "frontend", "dist", "index.html")
    );
  }

  mainWindow.on("closed", () => { mainWindow = null; });
}

ipcMain.handle("get-backend-port", () => backendPort);

app.whenReady().then(async () => {
  const dbPath = path.join(app.getPath("userData"), "archive.db");

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
