// ====== db.js — قاعدة البيانات + Firestore ======

// ====== DATA + CACHE (Firestore + localStorage) ======
const _cache = {};
const FS_PENDING_OPS_KEY = 'sj_pending_fs_ops';
const USER_LOCAL_OBJECT_KEYS = ['worker'];

// ---- Firestore helpers ----
window._fs = null;
window._fsUid = null;
window._fsReady = false;

function fsPath(col) {
  return `users/${window._fsUid}/${col}`;
}

function readPendingOps() {
  try {
    const raw = JSON.parse(localStorage.getItem(FS_PENDING_OPS_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writePendingOps(ops) {
  localStorage.setItem(FS_PENDING_OPS_KEY, JSON.stringify(ops));
  window.dispatchEvent(new CustomEvent('sj:pending-sync-changed', { detail: { count: ops.length } }));
}

function compactPendingOps(ops) {
  const latest = new Map();
  for (const op of ops) {
    if (!op || !op.col || !op.id || !op.type) continue;
    latest.set(`${op.col}:${op.id}`, op);
  }
  return Array.from(latest.values());
}

function appCollections() {
  return window.APP_COLLECTIONS || ['products', 'sales', 'transactions', 'installments', 'debts', 'repairs', 'workers'];
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

function pendingOpsByCollection(col) {
  const map = new Map();
  readPendingOps()
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
  appCollections().forEach(col => {
    localStorage.removeItem('sj_' + col);
    delete _cache[col];
  });
  USER_LOCAL_OBJECT_KEYS.forEach(key => {
    localStorage.removeItem('sj_' + key);
    delete _cache['_obj_' + key];
  });
  writePendingOps([]);
};

function queuePendingOp(op) {
  const ops = compactPendingOps([...readPendingOps(), { ...op, queuedAt: new Date().toISOString() }]);
  writePendingOps(ops);
}

window.getPendingFirestoreOpsCount = function() {
  return readPendingOps().length;
};

window.clearPendingFirestoreOps = function() {
  writePendingOps([]);
};

async function importFirestoreSdk() {
  return import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
}

async function flushPendingFirestoreOps() {
  if (!window._fs || !window._fsUid || !navigator.onLine) return false;
  let ops = readPendingOps();
  if (!ops.length) return true;
  try {
    const { doc, setDoc, deleteDoc } = await importFirestoreSdk();
    const remaining = [];
    for (const op of ops) {
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
    writePendingOps(compactPendingOps(remaining));
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
    let totalDocs = 0;
    for (const col of cols) {
      try {
        const snap = await getDocs(collection(window._fs, fsPath(col)));
        const cloudData = snap.docs.map(d => {
          const d2 = d.data();
          if (!d2.id) d2.id = d.id;
          return window.normalizeRecord ? normalizeRecord(col, d2) : d2;
        });
        const localData = readStoredCollection(col);
        const merged = mergeCollectionRecords(col, localData, cloudData);
        _cache[col] = merged;
        localStorage.setItem('sj_' + col, JSON.stringify(merged));
        totalDocs += merged.length;
      } catch (e) {
        console.warn('sync error col:', col, e);
      }
    }
    console.log(`✅ تمت المزامنة — ${totalDocs} سجل`);
  } catch (e) {
    console.error('syncFromFirestore خطأ:', e);
  }
}

async function fsSaveDoc(col, id, data) {
  if (!id) return;
  const clean = JSON.parse(JSON.stringify(data));
  if (!window._fs || !window._fsUid || !navigator.onLine) {
    queuePendingOp({ type: 'set', col, id: String(id), data: clean });
    return;
  }
  try {
    const { doc, setDoc } = await importFirestoreSdk();
    await setDoc(doc(window._fs, fsPath(col), String(id)), clean);
  } catch (e) {
    queuePendingOp({ type: 'set', col, id: String(id), data: clean });
    console.warn(`fsSaveDoc [${col}/${id}]:`, e.message);
  }
}

async function fsDeleteDoc(col, id) {
  if (!id) return;
  if (!window._fs || !window._fsUid || !navigator.onLine) {
    queuePendingOp({ type: 'delete', col, id: String(id) });
    return;
  }
  try {
    const { doc, deleteDoc } = await importFirestoreSdk();
    await deleteDoc(doc(window._fs, fsPath(col), String(id)));
    console.log(`🗑️ حُذف: ${col}/${id}`);
  } catch (e) {
    queuePendingOp({ type: 'delete', col, id: String(id) });
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
    try {
      _cache[k] = JSON.parse(localStorage.getItem('sj_' + k)) || [];
      if (Array.isArray(_cache[k]) && window.normalizeRecord) {
        _cache[k] = _cache[k].map(item => normalizeRecord(k, item));
      }
    } catch {
      _cache[k] = [];
    }
    return _cache[k];
  },

  set(k, v) {
    k = window.normalizeCollectionName ? normalizeCollectionName(k) : k;
    const prev = normalizeCollectionList(k, readStoredCollection(k));
    if (Array.isArray(v)) {
      const prevMap = new Map(prev.filter(item => item && item.id).map(item => [String(item.id), item]));
      v = v.map(item => {
        if (!item) return item;
        const prevItem = item.id ? prevMap.get(String(item.id)) : null;
        return stampRecordForWrite(k, item, prevItem);
      });
    }
    _cache[k] = v;
    localStorage.setItem('sj_' + k, JSON.stringify(v));
    if (Array.isArray(v)) {
      const nextIds = new Set(v.filter(item => item && item.id).map(item => String(item.id)));
      prev.forEach(item => {
        if (item && item.id && !nextIds.has(String(item.id))) {
          fsDeleteDoc(k, item.id);
        }
      });
      v.forEach(item => {
        if (item && item.id) fsSaveDoc(k, item.id, item);
      });
    }
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
    localStorage.setItem('sj_' + col, JSON.stringify(arr));
    fsSaveDoc(col, item.id, item);
    return item;
  },

  deleteOne(col, id) {
    col = window.normalizeCollectionName ? normalizeCollectionName(col) : col;
    const arr = DB.get(col).filter(x => x.id !== id);
    _cache[col] = arr;
    localStorage.setItem('sj_' + col, JSON.stringify(arr));
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
    localStorage.setItem('sj_transactions', JSON.stringify(arr));
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
