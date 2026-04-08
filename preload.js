const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nativeSqlite', {
  init: () => ipcRenderer.invoke('sqlite:init'),
  status: (uid) => ipcRenderer.invoke('sqlite:status', uid),
  statusSync: (uid) => ipcRenderer.sendSync('sqlite:status-sync', uid),
  importLocalSnapshot: (uid, snapshot) => ipcRenderer.invoke('sqlite:import-local-snapshot', uid, snapshot),
  putCollection: (uid, col, records) => ipcRenderer.invoke('sqlite:put-collection', uid, col, records),
  getCollection: (uid, col) => ipcRenderer.invoke('sqlite:get-collection', uid, col),
  getCollectionSync: (uid, col) => ipcRenderer.sendSync('sqlite:get-collection-sync', uid, col),
  replaceSyncQueue: (uid, ops) => ipcRenderer.invoke('sqlite:replace-sync-queue', uid, ops),
  replaceSyncQueueSync: (uid, ops) => ipcRenderer.sendSync('sqlite:replace-sync-queue-sync', uid, ops),
  getSyncQueue: (uid) => ipcRenderer.invoke('sqlite:get-sync-queue', uid),
  getSyncQueueSync: (uid) => ipcRenderer.sendSync('sqlite:get-sync-queue-sync', uid),
  clearSyncQueue: (uid) => ipcRenderer.invoke('sqlite:clear-sync-queue', uid),
  clearSyncQueueSync: (uid) => ipcRenderer.sendSync('sqlite:clear-sync-queue-sync', uid)
});
