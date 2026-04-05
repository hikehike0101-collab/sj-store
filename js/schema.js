// ====== schema.js - app database schema ======

const APP_COLLECTIONS = Object.freeze([
  'products',
  'sales',
  'transactions',
  'installments',
  'debts',
  'repairs',
  'workers'
]);

const APP_SCHEMA = Object.freeze({
  products:     { entity: 'product' },
  sales:        { entity: 'sale' },
  transactions: { entity: 'transaction' },
  installments: { entity: 'installment' },
  debts:        { entity: 'debt' },
  repairs:      { entity: 'repair' },
  workers:      { entity: 'worker' }
});

function schemaNowISO() {
  return new Date().toISOString();
}

function normalizeCollectionName(col) {
  return APP_COLLECTIONS.includes(col) ? col : col;
}

function normalizeRecord(col, item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  const record = { ...item };
  if (!record.id) record.id = genId();
  if (!record.createdAt) record.createdAt = record.date || schemaNowISO();
  if (!record.updatedAt) record.updatedAt = record.createdAt || schemaNowISO();
  record.schema = APP_SCHEMA[col]?.entity || col;
  return record;
}

window.APP_COLLECTIONS = APP_COLLECTIONS;
window.APP_SCHEMA = APP_SCHEMA;
window.normalizeCollectionName = normalizeCollectionName;
window.normalizeRecord = normalizeRecord;
