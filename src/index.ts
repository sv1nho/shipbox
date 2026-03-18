import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { registerIpcHandlers } from "./ipc-handlers.js";
import { BASE_DIR } from "./path.js";

const createWindow = (): void => {
  const win = new BrowserWindow({
    width: 700,
    height: 900,
    webPreferences: {
      preload: path.join(BASE_DIR(), "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  void win.loadFile(path.join(BASE_DIR(), "assets", "ui.html"));
};

void app.whenReady().then(() => {
  createWindow();
  registerIpcHandlers(ipcMain);

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
