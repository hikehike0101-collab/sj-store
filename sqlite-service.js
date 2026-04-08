const path = require('path');
const Database = require('better-sqlite3');
const { app, ipcMain } = require('electron');

const APP_COLLECTIONS = Object.freeze([
  'products',
  'sales',
  'transactions',
  'installments',
  'debts',
  'repairs',
  'warranties',
  'workers'
]);

let db = null;
let handlersRegistered = false;

function ensureDb() {
  if (db) return db;

  const dbPath = path.join(app.getPath('userData'), 'sj-store.sqlite');
  try {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    db.exec(`
      CREATE TABLE IF NOT EXISTS app_records (
        uid TEXT NOT NULL,
        col TEXT NOT NULL,
        id TEXT NOT NULL,
        json TEXT NOT NULL,
        updated_at TEXT,
        version INTEGER DEFAULT 0,
        PRIMARY KEY (uid, col, id)
      );

      CREATE TABLE IF NOT EXISTS sync_queue (
        uid TEXT NOT NULL,
        col TEXT NOT NULL,
        id TEXT NOT NULL,
        op_type TEXT NOT NULL,
        payload TEXT,
        queued_at TEXT NOT NULL,
        PRIMARY KEY (uid, col, id)
      );

      CREATE INDEX IF NOT EXISTS idx_app_records_uid_col
      ON app_records(uid, col);

      CREATE INDEX IF NOT EXISTS idx_sync_queue_uid
      ON sync_queue(uid);
    `);

    return db;
  } catch (error) {
    throw error;
  }
}

function safeUid(uid) {
  return String(uid || '').trim();
}

function normalizeCollection(col) {
  return APP_COLLECTIONS.includes(col) ? col : String(col || '').trim();
}

function putCollectionSnapshot(uid, col, records = []) {
  const userId = safeUid(uid);
  const collection = normalizeCollection(col);
  if (!userId || !collection) return { ok: false, count: 0 };

  const conn = ensureDb();
  const clearStmt = conn.prepare('DELETE FROM app_records WHERE uid = ? AND col = ?');
  const insertStmt = conn.prepare(`
    INSERT INTO app_records (uid, col, id, json, updated_at, version)
    VALUES (@uid, @col, @id, @json, @updated_at, @version)
    ON CONFLICT(uid, col, id) DO UPDATE SET
      json = excluded.json,
      updated_at = excluded.updated_at,
      version = excluded.version
  `);

  const write = conn.transaction((items) => {
    clearStmt.run(userId, collection);
    for (const record of items) {
      if (!record || !record.id) continue;
      insertStmt.run({
        uid: userId,
        col: collection,
        id: String(record.id),
        json: JSON.stringify(record),
        updated_at: record.updatedAt || record.createdAt || null,
        version: Number(record.version || 0)
      });
    }
  });

  write(Array.isArray(records) ? records : []);
  return { ok: true, count: Array.isArray(records) ? records.length : 0 };
}

function readCollectionSnapshot(uid, col) {
  const userId = safeUid(uid);
  const collection = normalizeCollection(col);
  if (!userId || !collection) return [];

  const conn = ensureDb();
  const rows = conn
    .prepare('SELECT json FROM app_records WHERE uid = ? AND col = ? ORDER BY updated_at DESC, id ASC')
    .all(userId, collection);

  return rows.map((row) => {
    try {
      return JSON.parse(row.json);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

function importLocalSnapshot(uid, snapshot = {}) {
  const userId = safeUid(uid);
  if (!userId || !snapshot || typeof snapshot !== 'object') {
    return { ok: false, importedCollections: 0 };
  }

  let importedCollections = 0;
  APP_COLLECTIONS.forEach((col) => {
    if (!Array.isArray(snapshot[col])) return;
    putCollectionSnapshot(userId, col, snapshot[col]);
    importedCollections += 1;
  });

  return { ok: true, importedCollections };
}

function queueSyncOp(uid, col, id, opType, payload = null) {
  const userId = safeUid(uid);
  const collection = normalizeCollection(col);
  if (!userId || !collection || !id) return;

  const conn = ensureDb();
  conn.prepare(`
    INSERT INTO sync_queue (uid, col, id, op_type, payload, queued_at)
    VALUES (@uid, @col, @id, @op_type, @payload, @queued_at)
    ON CONFLICT(uid, col, id) DO UPDATE SET
      op_type = excluded.op_type,
      payload = excluded.payload,
      queued_at = excluded.queued_at
  `).run({
    uid: userId,
    col: collection,
    id: String(id),
    op_type: opType,
    payload: payload ? JSON.stringify(payload) : null,
    queued_at: new Date().toISOString()
  });
}

function replaceSyncQueue(uid, ops = []) {
  const userId = safeUid(uid);
  if (!userId) return { ok: false, count: 0 };

  const conn = ensureDb();
  const clearStmt = conn.prepare('DELETE FROM sync_queue WHERE uid = ?');
  const insertStmt = conn.prepare(`
    INSERT INTO sync_queue (uid, col, id, op_type, payload, queued_at)
    VALUES (@uid, @col, @id, @op_type, @payload, @queued_at)
    ON CONFLICT(uid, col, id) DO UPDATE SET
      op_type = excluded.op_type,
      payload = excluded.payload,
      queued_at = excluded.queued_at
  `);

  const write = conn.transaction((items) => {
    clearStmt.run(userId);
    for (const op of items) {
      if (!op?.col || !op?.id || !op?.type) continue;
      insertStmt.run({
        uid: userId,
        col: normalizeCollection(op.col),
        id: String(op.id),
        op_type: op.type,
        payload: op.data ? JSON.stringify(op.data) : null,
        queued_at: op.queuedAt || new Date().toISOString()
      });
    }
  });

  write(Array.isArray(ops) ? ops : []);
  return { ok: true, count: Array.isArray(ops) ? ops.length : 0 };
}

function readSyncQueue(uid) {
  const userId = safeUid(uid);
  if (!userId) return [];

  const conn = ensureDb();
  const rows = conn.prepare(`
    SELECT col, id, op_type, payload, queued_at
    FROM sync_queue
    WHERE uid = ?
    ORDER BY queued_at ASC, col ASC, id ASC
  `).all(userId);

  return rows.map((row) => {
    let data = null;
    try {
      data = row.payload ? JSON.parse(row.payload) : null;
    } catch {
      data = null;
    }
    return {
      uid: userId,
      col: row.col,
      id: row.id,
      type: row.op_type,
      data,
      queuedAt: row.queued_at
    };
  });
}

function clearSyncQueue(uid) {
  const userId = safeUid(uid);
  if (!userId) return { ok: false, count: 0 };
  const conn = ensureDb();
  const info = conn.prepare('DELETE FROM sync_queue WHERE uid = ?').run(userId);
  return { ok: true, count: info.changes || 0 };
}

function getStatus(uid) {
  const userId = safeUid(uid);
  const conn = ensureDb();
  if (!userId) {
    return {
      ok: true,
      dbPath: conn.name,
      collections: {}
    };
  }

  const rows = conn.prepare(`
    SELECT col, COUNT(*) AS count
    FROM app_records
    WHERE uid = ?
    GROUP BY col
  `).all(userId);

  const collections = {};
  rows.forEach((row) => {
    collections[row.col] = row.count;
  });

  return {
    ok: true,
    dbPath: conn.name,
    collections
  };
}

function registerSqliteIpc() {
  if (handlersRegistered) return;
  handlersRegistered = true;

  ipcMain.handle('sqlite:init', async () => {
    const conn = ensureDb();
    return { ok: true, dbPath: conn.name, collections: APP_COLLECTIONS };
  });

  ipcMain.handle('sqlite:status', async (_event, uid) => {
    return getStatus(uid);
  });

  ipcMain.handle('sqlite:import-local-snapshot', async (_event, uid, snapshot) => {
    return importLocalSnapshot(uid, snapshot);
  });

  ipcMain.handle('sqlite:put-collection', async (_event, uid, col, records) => {
    return putCollectionSnapshot(uid, col, records);
  });

  ipcMain.handle('sqlite:get-collection', async (_event, uid, col) => {
    return {
      ok: true,
      records: readCollectionSnapshot(uid, col)
    };
  });

  ipcMain.handle('sqlite:replace-sync-queue', async (_event, uid, ops) => {
    return replaceSyncQueue(uid, ops);
  });

  ipcMain.handle('sqlite:get-sync-queue', async (_event, uid) => {
    return {
      ok: true,
      ops: readSyncQueue(uid)
    };
  });

  ipcMain.handle('sqlite:clear-sync-queue', async (_event, uid) => {
    return clearSyncQueue(uid);
  });

  ipcMain.on('sqlite:get-collection-sync', (event, uid, col) => {
    try {
      event.returnValue = {
        ok: true,
        records: readCollectionSnapshot(uid, col)
      };
    } catch (e) {
      event.returnValue = {
        ok: false,
        records: [],
        reason: e.message || 'sqlite_read_failed'
      };
    }
  });

  ipcMain.on('sqlite:status-sync', (event, uid) => {
    try {
      event.returnValue = getStatus(uid);
    } catch (e) {
      event.returnValue = {
        ok: false,
        reason: e.message || 'sqlite_status_failed'
      };
    }
  });

  ipcMain.on('sqlite:get-sync-queue-sync', (event, uid) => {
    try {
      event.returnValue = {
        ok: true,
        ops: readSyncQueue(uid)
      };
    } catch (e) {
      event.returnValue = {
        ok: false,
        ops: [],
        reason: e.message || 'sqlite_queue_read_failed'
      };
    }
  });

  ipcMain.on('sqlite:replace-sync-queue-sync', (event, uid, ops) => {
    try {
      event.returnValue = replaceSyncQueue(uid, ops);
    } catch (e) {
      event.returnValue = {
        ok: false,
        count: 0,
        reason: e.message || 'sqlite_queue_write_failed'
      };
    }
  });

  ipcMain.on('sqlite:clear-sync-queue-sync', (event, uid) => {
    try {
      event.returnValue = clearSyncQueue(uid);
    } catch (e) {
      event.returnValue = {
        ok: false,
        count: 0,
        reason: e.message || 'sqlite_queue_clear_failed'
      };
    }
  });
}

function closeSqlite() {
  if (!db) return;
  db.close();
  db = null;
}

module.exports = {
  APP_COLLECTIONS,
  ensureDb,
  getDbPath: () => path.join(app.getPath('userData'), 'sj-store.sqlite'),
  registerSqliteIpc,
  closeSqlite,
  importLocalSnapshot,
  putCollectionSnapshot,
  readCollectionSnapshot,
  getStatus,
  replaceSyncQueue,
  readSyncQueue,
  clearSyncQueue
};
