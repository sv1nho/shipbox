import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";
import { watch } from "chokidar";
import { registerIpcHandlers } from "./ipc-handlers.js";
import { BASE_DIR } from "./path.js";

let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 700,
    height: 900,
    webPreferences: {
      preload: path.join(BASE_DIR(), "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  void mainWindow.webContents.loadFile(
    path.join(BASE_DIR(), "assets", "ui.html"),
  );
};

void app.whenReady().then(() => {
  if (process.env["NODE_ENV"] === "test") {
    try {
      const distPath = path.join(BASE_DIR(), "..");
      const watcher = watch(distPath, {
        ignored: /node_modules/,
        persistent: true,
        awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 100 },
      });

      watcher.on("change", () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.reloadIgnoringCache();
        }
      });
    } catch {
      //eslint-disable-next-line no-console
      console.error("Hot reload not available");
    }
  }

  createWindow();
  if (mainWindow) {
    registerIpcHandlers(ipcMain, dialog, mainWindow);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
