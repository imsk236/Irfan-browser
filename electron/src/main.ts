import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron";
import { autoUpdater } from "electron-updater";
import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { writeFile, copyFile } from "fs/promises";

const isDev = !app.isPackaged;
let backendProcess: ChildProcess | null = null;
let backendPort = 0;
let mainWindow: BrowserWindow | null = null;
let currentDbPath = "";

// ── Database location config ─────────────────────────────────────────────────
// Persisted separately from the db itself (in userData/config.json) so the
// custom location is known before the backend spawns and before any renderer
// loads. `dbPath` is the active custom location (if any); `pendingDbPath` is
// set by the Settings UI and applied once, on the next app start, before the
// backend is spawned — never while it's live.

interface AppConfig {
  dbPath?: string;
  pendingDbPath?: string;
}

function configPath(): string {
  return path.join(app.getPath("userData"), "config.json");
}

function readConfig(): AppConfig {
  try {
    return JSON.parse(fs.readFileSync(configPath(), "utf-8"));
  } catch {
    return {};
  }
}

function writeConfig(config: AppConfig): void {
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2), "utf-8");
}

function copyDbFile(fromPath: string, toPath: string): void {
  fs.mkdirSync(path.dirname(toPath), { recursive: true });
  for (const suffix of ["", "-wal", "-shm"]) {
    const src = fromPath + suffix;
    if (fs.existsSync(src)) fs.copyFileSync(src, toPath + suffix);
  }
}

/**
 * Applies a pending relocation requested via Settings, before this session's
 * dbPath is resolved. If the target already has an archive.db (the drive was
 * already set up from another device), adopt it as-is rather than overwrite.
 * Otherwise copy the currently active database there.
 */
function applyPendingRelocation(config: AppConfig, defaultDbPath: string): AppConfig {
  if (!config.pendingDbPath) return config;

  const target = config.pendingDbPath;
  const active = config.dbPath || defaultDbPath;

  try {
    if (!fs.existsSync(target)) {
      copyDbFile(active, target);
    }
    const next: AppConfig = { dbPath: target };
    writeConfig(next);
    return next;
  } catch (err) {
    console.error("[db] relocation failed:", err);
    dialog.showErrorBox(
      "تعذّر نقل قاعدة البيانات",
      "لم يتمكن البرنامج من نقل قاعدة البيانات إلى الموقع الجديد. سيستمر استخدام الموقع السابق."
    );
    const next: AppConfig = { dbPath: config.dbPath };
    writeConfig(next);
    return next;
  }
}

/**
 * Resolves which db path to use this session. If a custom path is configured
 * but its drive/folder isn't currently reachable (e.g. an external drive is
 * unplugged), falls back to the default path for this session only — the
 * config is left untouched so the custom path is retried on the next launch.
 */
function resolveDbPath(config: AppConfig, defaultDbPath: string): string {
  if (!config.dbPath) return defaultDbPath;

  if (!fs.existsSync(path.dirname(config.dbPath))) {
    console.warn(
      `[db] configured location unreachable, falling back to default: ${config.dbPath}`
    );
    return defaultDbPath;
  }
  return config.dbPath;
}

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
      : path.join((process as any).resourcesPath as string, "icon.ico"),
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

ipcMain.handle("update:download", () => autoUpdater.downloadUpdate());
ipcMain.handle("update:install", () => autoUpdater.quitAndInstall());

ipcMain.handle("dialog:open-directory", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"],
    title: "اختر مجلد التصدير",
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("db:get-path", () => currentDbPath);

ipcMain.handle("db:choose-location", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"],
    title: "اختر موقع قاعدة البيانات",
  });
  if (result.canceled || !result.filePaths[0]) return null;

  const folder = result.filePaths[0];
  const target = path.join(folder, "archive.db");

  if (path.normalize(target) === path.normalize(currentDbPath)) {
    return { status: "unchanged", path: target };
  }

  if (fs.existsSync(target)) {
    return { status: "adopt", path: target };
  }

  return { status: "new", path: target };
});

ipcMain.handle("db:confirm-location", (_, targetPath: string) => {
  const config = readConfig();
  writeConfig({ ...config, pendingDbPath: targetPath });
});

ipcMain.handle("app:restart", () => {
  app.relaunch();
  app.exit();
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
  Menu.setApplicationMenu(null);
  const defaultDbPath = path.join(app.getPath("userData"), "archive.db");

  let config = readConfig();
  config = applyPendingRelocation(config, defaultDbPath);

  const dbPath = resolveDbPath(config, defaultDbPath);
  currentDbPath = dbPath;

  // On first launch in production, copy the bundled seed database to userData.
  if (!isDev && dbPath === defaultDbPath && !fs.existsSync(dbPath)) {
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
      console.error("[backend] failed to start:", err);
      dialog.showErrorBox("فشل تشغيل البرنامج", "تعذّر تشغيل الخدمة الخلفية. أعد تشغيل البرنامج، وإذا تكررت المشكلة تواصل مع الدعم الفني.");
      app.quit();
      return;
    }
  }

  createWindow(backendPort);

  if (!isDev) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("update-available", (info) => {
      console.log("[updater] update available:", info.version);
      mainWindow?.webContents.send("update:available", { version: info.version });
    });

    autoUpdater.on("update-not-available", (info) => {
      console.log("[updater] up to date, current:", app.getVersion(), "latest:", info.version);
      dialog.showMessageBox({ type: "info", title: "التحديث", message: "البرنامج محدَّث.", buttons: ["حسناً"] });
    });

    autoUpdater.on("download-progress", (progress) => {
      mainWindow?.webContents.send("update:progress", { percent: Math.round(progress.percent) });
    });

    autoUpdater.on("update-downloaded", (info) => {
      console.log("[updater] downloaded:", info.version);
      mainWindow?.webContents.send("update:downloaded");
    });

    autoUpdater.on("error", (err) => {
      console.error("[updater] error:", err.message, err.stack);
      dialog.showErrorBox("خطأ في التحديث", "تعذّر التحقق من وجود تحديث أو تنزيله. حاول لاحقاً.");
    });

    // Check 3 seconds after launch so the window is visible first
    setTimeout(() => autoUpdater.checkForUpdates().catch((err) => {
      console.error("[updater] checkForUpdates rejected:", err);
    }), 3000);
  }
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
