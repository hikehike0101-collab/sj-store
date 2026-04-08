// ====== db.js — قاعدة البيانات + Firestore ======

// ====== DATA + CACHE (Firestore + localStorage) ======
const _cache = {};
const FS_PENDING_OPS_KEY = 'sj_pending_fs_ops';
const USER_LOCAL_OBJECT_KEYS = ['worker'];
let _sqliteReady = false;
let _sqliteLastImportedUid = null;
let _sqliteStatusCache = new Map();
let _sqlitePendingOpsMigratedUid = new Set();

// ---- Firestore helpers ----
window._fs = null;
window._fsUid = null;
window._fsReady = false;

function fsPath(col) {
  return `users/${window._fsUid}/${col}`;
}

function compactPendingOps(ops) {
  const latest = new Map();
  for (const op of ops) {
    if (!op || !op.col || !op.id || !op.type) continue;
    latest.set(`${op.uid || 'legacy'}:${op.col}:${op.id}`, op);
  }
  return Array.from(latest.values());
}

function currentPendingOps() {
  const uid = (typeof currentUserUid === 'function' ? currentUserUid() : '') || window._fsUid || localStorage.getItem('sj_uid') || null;
  return readPendingOps().filter(op => {
    if (!op) return false;
    if (!uid) return true;
    return !op.uid || op.uid === uid;
  });
}

function appCollections() {
  return window.APP_COLLECTIONS || ['products', 'sales', 'transactions', 'installments', 'debts', 'repairs', 'warranties', 'workers'];
}

function sqliteApi() {
  return window.nativeSqlite || null;
}

function canReadSqliteSync() {
  const api = sqliteApi();
  return !!api?.getCollectionSync;
}

function canReadSqliteQueueSync() {
  const api = sqliteApi();
  return !!api?.getSyncQueueSync;
}

function canWriteSqliteQueueSync() {
  const api = sqliteApi();
  return !!api?.replaceSyncQueueSync && !!api?.clearSyncQueueSync;
}

async function ensureSqliteReady() {
  const api = sqliteApi();
  if (!api?.init) return false;
  if (_sqliteReady) return true;
  try {
    await api.init();
    _sqliteReady = true;
    return true;
  } catch (e) {
    console.warn('ensureSqliteReady:', e.message);
    return false;
  }
}

function currentDbUserUid() {
  return (typeof currentUserUid === 'function' ? currentUserUid() : '') || window._fsUid || localStorage.getItem('sj_uid') || '';
}

function legacyPendingOpsRaw() {
  try {
    const raw = JSON.parse(localStorage.getItem(FS_PENDING_OPS_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function migrateLegacyPendingOpsToSqliteSync(uid = currentDbUserUid()) {
  if (!uid || !canWriteSqliteQueueSync() || _sqlitePendingOpsMigratedUid.has(uid)) return;
  const legacyOps = legacyPendingOpsRaw().filter(op => !op?.uid || op.uid === uid);
  if (!legacyOps.length) {
    _sqlitePendingOpsMigratedUid.add(uid);
    return;
  }
  try {
    const result = sqliteApi().replaceSyncQueueSync(uid, compactPendingOps(legacyOps));
    if (result?.ok) _sqlitePendingOpsMigratedUid.add(uid);
  } catch (e) {
    console.warn('migrateLegacyPendingOpsToSqliteSync:', e.message);
  }
}

function readPendingOpsFromSqliteSync(uid = currentDbUserUid()) {
  if (!uid || !canReadSqliteQueueSync()) return null;
  migrateLegacyPendingOpsToSqliteSync(uid);
  try {
    const response = sqliteApi().getSyncQueueSync(uid);
    if (!response?.ok || !Array.isArray(response.ops)) return null;
    return response.ops;
  } catch (e) {
    console.warn('readPendingOpsFromSqliteSync:', e.message);
    return null;
  }
}

function readPendingOps() {
  const uid = currentDbUserUid();
  const sqliteOps = readPendingOpsFromSqliteSync(uid);
  if (Array.isArray(sqliteOps)) {
    if (!canReadSqliteQueueSync()) {
      localStorage.setItem(FS_PENDING_OPS_KEY, JSON.stringify(sqliteOps));
    } else {
      localStorage.removeItem(FS_PENDING_OPS_KEY);
    }
    return sqliteOps;
  }
  return legacyPendingOpsRaw();
}

function writePendingOps(ops) {
  const normalizedOps = Array.isArray(ops) ? ops : [];
  const uid = currentDbUserUid();
  if (uid && canWriteSqliteQueueSync()) {
    try {
      sqliteApi().replaceSyncQueueSync(uid, normalizedOps);
      _sqlitePendingOpsMigratedUid.add(uid);
    } catch (e) {
      console.warn('writePendingOps sqlite:', e.message);
    }
  }
  if (!canWriteSqliteQueueSync()) {
    localStorage.setItem(FS_PENDING_OPS_KEY, JSON.stringify(normalizedOps));
  } else {
    localStorage.removeItem(FS_PENDING_OPS_KEY);
  }
  window.dispatchEvent(new CustomEvent('sj:pending-sync-changed', { detail: { count: normalizedOps.length } }));
}

function readSqliteStatusSync(uid = currentDbUserUid()) {
  if (!uid) return null;
  if (_sqliteStatusCache.has(uid)) return _sqliteStatusCache.get(uid);
  const api = sqliteApi();
  if (!api?.statusSync) return null;
  try {
    const status = api.statusSync(uid);
    if (status?.ok) _sqliteStatusCache.set(uid, status);
    return status;
  } catch (e) {
    console.warn('readSqliteStatusSync:', e.message);
    return null;
  }
}

function readSqliteCollectionSync(col, uid = currentDbUserUid()) {
  if (!uid || !canReadSqliteSync()) return null;
  try {
    const response = sqliteApi().getCollectionSync(uid, col);
    if (!response?.ok || !Array.isArray(response.records)) return null;
    return response.records;
  } catch (e) {
    console.warn(`readSqliteCollectionSync [${col}]:`, e.message);
    return null;
  }
}

function shouldMirrorCollectionsToLocalStorage(uid = currentDbUserUid()) {
  if (!uid) return true;
  if (!canReadSqliteSync()) return true;
  return false;
}

function persistCollectionLocalMirror(col, records) {
  if (shouldMirrorCollectionsToLocalStorage()) {
    localStorage.setItem('sj_' + col, JSON.stringify(records));
    return;
  }
  localStorage.removeItem('sj_' + col);
}

function cleanupLegacyCollectionMirrors(uid = currentDbUserUid()) {
  if (!uid) return;
  const status = readSqliteStatusSync(uid);
  if (!status?.ok) return;
  appCollections().forEach((col) => {
    localStorage.removeItem('sj_' + col);
  });
}

window.importCurrentLocalStateToSqlite = async function importCurrentLocalStateToSqlite(uid = currentDbUserUid()) {
  if (!uid) return false;
  if (!(await ensureSqliteReady())) return false;
  const api = sqliteApi();
  if (!api?.importLocalSnapshot) return false;
  const snapshot = {};
  appCollections().forEach((col) => {
    snapshot[col] = normalizeCollectionList(col, readLocalCollectionSource(col));
  });
  try {
    await api.importLocalSnapshot(uid, snapshot);
    _sqliteLastImportedUid = uid;
    _sqliteStatusCache.delete(uid);
    cleanupLegacyCollectionMirrors(uid);
    return true;
  } catch (e) {
    console.warn('importCurrentLocalStateToSqlite:', e.message);
    return false;
  }
};

window.getSqliteMigrationStatus = async function getSqliteMigrationStatus(uid = currentDbUserUid()) {
  if (!(await ensureSqliteReady())) return { ok: false, reason: 'sqlite_unavailable' };
  const api = sqliteApi();
  if (!api?.status) return { ok: false, reason: 'status_unavailable' };
  try {
    return await api.status(uid);
  } catch (e) {
    return { ok: false, reason: e.message || 'status_failed' };
  }
};

async function mirrorCollectionToSqlite(col, records) {
  const uid = currentDbUserUid();
  if (!uid || !Array.isArray(records)) return;
  if (!(await ensureSqliteReady())) return;
  const api = sqliteApi();
  if (!api?.putCollection) return;
  try {
    await api.putCollection(uid, col, records);
    _sqliteStatusCache.delete(uid);
    cleanupLegacyCollectionMirrors(uid);
  } catch (e) {
    console.warn(`mirrorCollectionToSqlite [${col}]:`, e.message);
  }
}

function readLocalCollectionSource(col) {
  const sqliteRecords = readSqliteCollectionSync(col);
  if (Array.isArray(sqliteRecords)) return sqliteRecords;
  return readStoredCollection(col);
}

function normalizeCollectionList(col, items) {
  const arr = Array.isArray(items) ? items : [];
  if (!window.normalizeRecord) return arr;
  return arr.map(item => normalizeRecord(col, item));
}

function recordTimestamp(record) {
  const raw = record?.updatedAt || record?.createdAt || 0;
  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? ts : 0;
}

function recordVersion(record) {
  const n = Number(record?.version || 0);
  return Number.isFinite(n) ? n : 0;
}

function compareRecordFreshness(a, b) {
  const tsDiff = recordTimestamp(a) - recordTimestamp(b);
  if (tsDiff !== 0) return tsDiff;
  const versionDiff = recordVersion(a) - recordVersion(b);
  if (versionDiff !== 0) return versionDiff;
  return 0;
}

function stampRecordForWrite(col, next, previous = null) {
  const base = window.normalizeRecord ? normalizeRecord(col, next) : { ...next };
  const now = new Date().toISOString();
  const createdAt = previous?.createdAt || base.createdAt || now;
  return {
    ...base,
    createdAt,
    updatedAt: now,
    version: Math.max(recordVersion(previous), recordVersion(base), 0) + 1
  };
}

function comparableRecordShape(col, record, previous = null) {
  const normalized = window.normalizeRecord ? normalizeRecord(col, record) : { ...record };
  const comparable = {
    ...normalized,
    createdAt: previous?.createdAt || normalized.createdAt || null
  };
  delete comparable.updatedAt;
  delete comparable.version;
  return comparable;
}

function recordsHaveMeaningfulChanges(col, previous, next) {
  if (!previous) return true;
  try {
    return JSON.stringify(comparableRecordShape(col, previous, previous)) !== JSON.stringify(comparableRecordShape(col, next, previous));
  } catch {
    return true;
  }
}

function pendingOpsByCollection(col) {
  const map = new Map();
  currentPendingOps()
    .filter(op => op && op.col === col && op.id)
    .forEach(op => map.set(String(op.id), op));
  return map;
}

function mergeCollectionRecords(col, localItems, cloudItems) {
  const localMap = new Map(normalizeCollectionList(col, localItems).map(item => [String(item.id), item]));
  const cloudMap = new Map(normalizeCollectionList(col, cloudItems).map(item => [String(item.id), item]));
  const pendingMap = pendingOpsByCollection(col);
  const merged = [];
  const ids = new Set([...localMap.keys(), ...cloudMap.keys(), ...pendingMap.keys()]);

  ids.forEach(id => {
    const pending = pendingMap.get(id);
    if (pending?.type === 'delete') return;

    if (pending?.type === 'set' && pending.data) {
      merged.push(window.normalizeRecord ? normalizeRecord(col, pending.data) : pending.data);
      return;
    }

    const local = localMap.get(id);
    const cloud = cloudMap.get(id);

    if (local && cloud) {
      if (compareRecordFreshness(local, cloud) > 0) {
        merged.push(local);
        queuePendingOp({ type: 'set', col, id, data: local });
      } else {
        merged.push(cloud);
      }
      return;
    }

    if (cloud) {
      merged.push(cloud);
    }
  });

  return merged;
}

window.clearUserDataCache = function() {
  const uid = currentDbUserUid();
  appCollections().forEach(col => {
    localStorage.removeItem('sj_' + col);
    delete _cache[col];
  });
  USER_LOCAL_OBJECT_KEYS.forEach(key => {
    localStorage.removeItem('sj_' + key);
    delete _cache['_obj_' + key];
  });
  _sqliteStatusCache.clear();
  if (uid) _sqlitePendingOpsMigratedUid.delete(uid);
};

function queuePendingOp(op) {
  const uid = op.uid || currentDbUserUid() || null;
  const ops = compactPendingOps([...readPendingOps(), { ...op, uid, queuedAt: new Date().toISOString() }]);
  writePendingOps(ops);
}

window.getPendingFirestoreOpsCount = function() {
  return currentPendingOps().length;
};

window.clearPendingFirestoreOps = function() {
  const uid = currentDbUserUid();
  if (uid && canWriteSqliteQueueSync()) {
    try {
      sqliteApi().clearSyncQueueSync(uid);
      _sqlitePendingOpsMigratedUid.add(uid);
    } catch (e) {
      console.warn('clearPendingFirestoreOps sqlite:', e.message);
    }
  }
  writePendingOps([]);
};

async function importFirestoreSdk() {
  return import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
}

async function flushPendingFirestoreOps() {
  if (!window._fs || !window._fsUid || !navigator.onLine) return false;
  const ops = readPendingOps();
  if (!ops.length) return true;
  const currentOps = ops.filter(op => !op?.uid || op.uid === window._fsUid);
  const otherOps = ops.filter(op => op?.uid && op.uid !== window._fsUid);
  if (!currentOps.length) return true;
  try {
    const { doc, setDoc, deleteDoc } = await importFirestoreSdk();
    const remaining = [];
    for (const op of currentOps) {
      try {
        if (op.type === 'delete') {
          await deleteDoc(doc(window._fs, fsPath(op.col), String(op.id)));
        } else {
          const clean = JSON.parse(JSON.stringify(op.data || {}));
          await setDoc(doc(window._fs, fsPath(op.col), String(op.id)), clean);
        }
      } catch (e) {
        remaining.push(op);
        console.warn(`pending op failed [${op.type}:${op.col}/${op.id}]`, e.message);
      }
    }
    writePendingOps(compactPendingOps([...otherOps, ...remaining]));
    return remaining.length === 0;
  } catch (e) {
    console.warn('flushPendingFirestoreOps:', e.message);
    return false;
  }
}

window.flushPendingFirestoreOps = flushPendingFirestoreOps;

async function ensurePendingOpsFlushed(maxAttempts = 3) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const ok = await flushPendingFirestoreOps();
    if (ok && readPendingOps().length === 0) return true;
  }
  return readPendingOps().length === 0;
}

window.initFirestore = async function(uid) {
  window._fsUid = uid;
  window._fsReady = true;
  const pendingCleared = await ensurePendingOpsFlushed();
  if (!pendingCleared) {
    console.warn('initFirestore: pending ops still queued, skipping cloud pull for now');
    return false;
  }
  await syncFromFirestore();
  await ensurePendingOpsFlushed();
  return true;
};

async function syncFromFirestore() {
  if (!window._fs || !window._fsUid || !navigator.onLine) {
    console.warn('syncFromFirestore: fs أو uid غير جاهز أو لا يوجد إنترنت');
    return;
  }
  try {
    const { collection, getDocs } = await importFirestoreSdk();
    const cols = appCollections();
    const sqliteSnapshot = {};
    let totalDocs = 0;
    for (const col of cols) {
      try {
        const snap = await getDocs(collection(window._fs, fsPath(col)));
        const cloudData = snap.docs.map(d => {
          const d2 = d.data();
          if (!d2.id) d2.id = d.id;
          return window.normalizeRecord ? normalizeRecord(col, d2) : d2;
        });
        const localData = readLocalCollectionSource(col);
        const merged = mergeCollectionRecords(col, localData, cloudData);
        _cache[col] = merged;
        sqliteSnapshot[col] = merged;
        persistCollectionLocalMirror(col, merged);
        totalDocs += merged.length;
      } catch (e) {
        console.warn('sync error col:', col, e);
      }
    }
    if (Object.keys(sqliteSnapshot).length && (await ensureSqliteReady())) {
      try {
        await sqliteApi()?.importLocalSnapshot?.(window._fsUid, sqliteSnapshot);
        _sqliteLastImportedUid = window._fsUid;
        _sqliteStatusCache.delete(window._fsUid);
      } catch (e) {
        console.warn('syncFromFirestore sqlite import:', e.message);
      }
    }
    cleanupLegacyCollectionMirrors(window._fsUid);
    console.log(`✅ تمت المزامنة — ${totalDocs} سجل`);
  } catch (e) {
    console.error('syncFromFirestore خطأ:', e);
  }
}

async function fsSaveDoc(col, id, data) {
  if (!id) return;
  const clean = JSON.parse(JSON.stringify(data));
  queuePendingOp({ type: 'set', col, id: String(id), data: clean });
  if (!window._fs || !window._fsUid || !navigator.onLine) return;
  try {
    await flushPendingFirestoreOps();
  } catch (e) {
    console.warn(`fsSaveDoc [${col}/${id}]:`, e.message);
  }
}

async function fsDeleteDoc(col, id) {
  if (!id) return;
  queuePendingOp({ type: 'delete', col, id: String(id) });
  if (!window._fs || !window._fsUid || !navigator.onLine) return;
  try {
    await flushPendingFirestoreOps();
    console.log(`🗑️ حُذف: ${col}/${id}`);
  } catch (e) {
    console.warn(`fsDeleteDoc [${col}/${id}]:`, e.message);
  }
}

function genFsId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function readStoredCollection(k) {
  try {
    const raw = JSON.parse(localStorage.getItem('sj_' + k)) || [];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

const DB = {
  get(k) {
    k = window.normalizeCollectionName ? normalizeCollectionName(k) : k;
    if (_cache[k] !== undefined) return _cache[k];

    const uid = currentDbUserUid();
    const sqliteRecords = readSqliteCollectionSync(k);
    const sqliteStatus = readSqliteStatusSync(uid);
    const sqliteImportedForUser = _sqliteLastImportedUid === uid;
    const sqliteHasKnownState =
      !!uid &&
      (
        sqliteImportedForUser ||
        (sqliteStatus?.ok && Object.keys(sqliteStatus.collections || {}).length > 0)
      );

    if (Array.isArray(sqliteRecords) && (sqliteRecords.length || sqliteHasKnownState)) {
      _cache[k] = normalizeCollectionList(k, sqliteRecords);
      persistCollectionLocalMirror(k, _cache[k]);
      return _cache[k];
    }

    try {
      const parsed = JSON.parse(localStorage.getItem('sj_' + k)) || [];
      _cache[k] = Array.isArray(parsed) ? parsed : [];
      if (window.normalizeRecord) {
        _cache[k] = _cache[k].map(item => normalizeRecord(k, item));
      }
    } catch {
      _cache[k] = [];
    }
    return _cache[k];
  },

  set(k, v) {
    k = window.normalizeCollectionName ? normalizeCollectionName(k) : k;
    const prev = normalizeCollectionList(k, readLocalCollectionSource(k));
    if (Array.isArray(v)) {
      const prevMap = new Map(prev.filter(item => item && item.id).map(item => [String(item.id), item]));
      const changedItems = [];
      v = v.map(item => {
        if (!item) return item;
        const normalized = window.normalizeRecord ? normalizeRecord(k, item) : { ...item };
        const prevItem = normalized.id ? prevMap.get(String(normalized.id)) : null;
        if (recordsHaveMeaningfulChanges(k, prevItem, normalized)) {
          const stamped = stampRecordForWrite(k, normalized, prevItem);
          changedItems.push(stamped);
          return stamped;
        }
        return prevItem || normalized;
      });
      _cache[k] = v;
      persistCollectionLocalMirror(k, v);
      mirrorCollectionToSqlite(k, v);
      const nextIds = new Set(v.filter(item => item && item.id).map(item => String(item.id)));
      prev.forEach(item => {
        if (item && item.id && !nextIds.has(String(item.id))) {
          fsDeleteDoc(k, item.id);
        }
      });
      changedItems.forEach(item => {
        if (item && item.id) fsSaveDoc(k, item.id, item);
      });
      return;
    }
    _cache[k] = v;
    persistCollectionLocalMirror(k, v);
  },

  saveOne(col, item) {
    col = window.normalizeCollectionName ? normalizeCollectionName(col) : col;
    if (!item.id) item.id = genFsId();
    const arr = DB.get(col);
    const idx = arr.findIndex(x => x.id === item.id);
    const prevItem = idx >= 0 ? arr[idx] : null;
    item = stampRecordForWrite(col, item, prevItem);
    if (idx >= 0) arr[idx] = item; else arr.push(item);
    _cache[col] = arr;
    persistCollectionLocalMirror(col, arr);
    mirrorCollectionToSqlite(col, arr);
    fsSaveDoc(col, item.id, item);
    return item;
  },

  deleteOne(col, id) {
    col = window.normalizeCollectionName ? normalizeCollectionName(col) : col;
    const arr = DB.get(col).filter(x => x.id !== id);
    _cache[col] = arr;
    persistCollectionLocalMirror(col, arr);
    mirrorCollectionToSqlite(col, arr);
    fsDeleteDoc(col, id);
  },

  addTransaction(data) {
    const tx = stampRecordForWrite('transactions', {
      ...data,
      id: genFsId(),
      createdAt: new Date().toISOString()
    });
    const arr = DB.get('transactions');
    arr.push(tx);
    _cache.transactions = arr;
    persistCollectionLocalMirror('transactions', arr);
    mirrorCollectionToSqlite('transactions', arr);
    fsSaveDoc('transactions', tx.id, tx);
    return tx;
  },

  obj(k, d = {}) {
    const key = '_obj_' + k;
    if (_cache[key] !== undefined) return _cache[key];
    try {
      _cache[key] = JSON.parse(localStorage.getItem('sj_' + k)) || d;
    } catch {
      _cache[key] = d;
    }
    return _cache[key];
  },

  setObj(k, v) {
    _cache['_obj_' + k] = v;
    localStorage.setItem('sj_' + k, JSON.stringify(v));
  },

  clear(k) {
    k = window.normalizeCollectionName ? normalizeCollectionName(k) : k;
    delete _cache[k];
    delete _cache['_obj_' + k];
  },

  clearAll() {
    Object.keys(_cache).forEach(k => delete _cache[k]);
  }
};

window.DB = DB;

window.addEventListener('online', async () => {
  if (window._fsReady && window._fsUid) {
    const flushed = await flushPendingFirestoreOps();
    if (flushed) await syncFromFirestore();
  }
});
