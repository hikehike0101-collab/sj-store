const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { ensureDb, registerSqliteIpc, closeSqlite } = require('./sqlite-service');

// تقليل استهلاك الذاكرة قدر الإمكان داخل Electron.
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('renderer-process-limit', '1');

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function buildUpdateWindowHtml({ title, message, percent, transferredText }) {
  const progress = Math.max(0, Math.min(100, Number(percent) || 0));

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --bg-top: #fff6dd;
      --bg-bottom: #efe2c4;
      --card: rgba(255, 251, 242, 0.96);
      --text: #1e2329;
      --muted: #6b7280;
      --track: #e8dcc4;
      --fill-a: #ab670b;
      --fill-b: #d8a03d;
      --border: #dbc5a1;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: "Segoe UI", Tahoma, sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at top right, var(--bg-top) 0%, transparent 36%),
        linear-gradient(135deg, #f7eedb 0%, var(--bg-bottom) 100%);
    }
    .card {
      width: calc(100% - 32px);
      max-width: 420px;
      padding: 24px;
      border-radius: 18px;
      border: 1px solid var(--border);
      background: var(--card);
      box-shadow: 0 20px 60px rgba(87, 59, 14, 0.15);
    }
    h1 {
      margin: 0 0 10px;
      font-size: 22px;
      color: #7d4b06;
    }
    p {
      margin: 0 0 14px;
      line-height: 1.8;
      font-size: 15px;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 14px;
      color: var(--muted);
    }
    .row strong {
      color: #7d4b06;
      font-size: 15px;
    }
    .track {
      width: 100%;
      height: 14px;
      overflow: hidden;
      border-radius: 999px;
      background: var(--track);
      border: 1px solid rgba(125, 75, 6, 0.08);
    }
    .bar {
      height: 100%;
      width: ${progress}%;
      border-radius: 999px;
      background: linear-gradient(90deg, var(--fill-a) 0%, var(--fill-b) 100%);
      transition: width 0.25s ease;
    }
    .meta {
      min-height: 22px;
      margin-top: 10px;
      font-size: 13px;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <div class="row">
      <span>نسبة التقدم</span>
      <strong>${progress}%</strong>
    </div>
    <div class="track">
      <div class="bar"></div>
    </div>
    <div class="meta">${escapeHtml(transferredText || '')}</div>
  </div>
</body>
</html>`;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: true,
      disableBlinkFeatures: 'Auxclick',
    },
    show: false,
    titleBarStyle: 'default',
    backgroundColor: '#F0F2F8',
  });

  win.loadFile('index.html');

  win.once('ready-to-show', () => {
    win.show();
    win.maximize();
  });

  win.on('minimize', () => {
    win.webContents.session.clearCache();
    if (global.gc) global.gc();
  });

  setInterval(() => {
    if (win && !win.isDestroyed()) {
      win.webContents.session.clearCache();
    }
  }, 5 * 60 * 1000);

  return win;
}

function createUpdateProgressWindow(parent) {
  return new BrowserWindow({
    width: 460,
    height: 280,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    modal: true,
    parent,
    autoHideMenuBar: true,
    title: 'تحديث التطبيق',
    backgroundColor: '#f5f1e8',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
}

function updateProgressWindow(win, state) {
  if (!win || win.isDestroyed()) return;

  const html = buildUpdateWindowHtml(state);
  win.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`);

  if (!win.isVisible()) {
    win.once('ready-to-show', () => {
      if (!win.isDestroyed()) win.show();
    });
  }
}

function closeUpdateWindow(win) {
  if (win && !win.isDestroyed()) {
    win.close();
  }
}

function setupAutoUpdates(win) {
  if (!app.isPackaged) return;

  let updateWindow = null;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (error) => {
    console.error('Auto update error:', error);
    closeUpdateWindow(updateWindow);
    updateWindow = null;
  });

  autoUpdater.on('update-available', async () => {
    const result = await dialog.showMessageBox(win, {
      type: 'info',
      title: 'تحديث جديد',
      message: 'يوجد تحديث جديد للتطبيق.',
      detail: 'هل تريد تنزيل التحديث الآن؟',
      buttons: ['تنزيل الآن', 'لاحقاً'],
      defaultId: 0,
      cancelId: 1,
    });

    if (result.response === 0) {
      updateWindow = createUpdateProgressWindow(win);
      updateProgressWindow(updateWindow, {
        title: 'جاري تنزيل التحديث',
        message: 'يتم الآن تنزيل التحديث الجديد. انتظر حتى يكتمل التنزيل.',
        percent: 0,
        transferredText: 'تم بدء تنزيل التحديث',
      });
      autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on('download-progress', (progress) => {
    if (!updateWindow || updateWindow.isDestroyed()) return;

    updateProgressWindow(updateWindow, {
      title: 'جاري تنزيل التحديث',
      message: 'يتم تنزيل التحديث الجديد الآن. يمكنك متابعة النسبة من الشريط أدناه.',
      percent: Math.round(progress.percent || 0),
      transferredText: `${formatBytes(progress.transferred)} / ${formatBytes(progress.total)}`,
    });
  });

  autoUpdater.on('update-downloaded', async () => {
    closeUpdateWindow(updateWindow);
    updateWindow = null;

    const result = await dialog.showMessageBox(win, {
      type: 'info',
      title: 'التحديث جاهز',
      message: 'تم تنزيل التحديث بنجاح.',
      detail: 'هل تريد إعادة تشغيل التطبيق الآن لتثبيت التحديث؟',
      buttons: ['إعادة التشغيل الآن', 'لاحقاً'],
      defaultId: 0,
      cancelId: 1,
    });

    if (result.response === 0) {
      setImmediate(() => autoUpdater.quitAndInstall());
    }
  });

  autoUpdater.on('update-not-available', () => {
    console.log('No updates available');
  });

  win.once('ready-to-show', () => {
    autoUpdater.checkForUpdates();
  });
}

app.whenReady().then(() => {
  ensureDb();
  registerSqliteIpc();
  const win = createWindow();
  setupAutoUpdates(win);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  app.commandLine.appendSwitch('purge-memory-button');
  closeSqlite();
});
