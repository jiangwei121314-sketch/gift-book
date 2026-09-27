/**
 * IndexedDB 数据持久化层
 * 与电脑版 data.json 格式完全兼容
 */
const DB_NAME = 'gift_book_db';
const DB_VERSION = 1;
const STORE_BOOKS = 'books';
const STORE_META = 'meta';

let _db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) { resolve(_db); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_BOOKS)) {
        db.createObjectStore(STORE_BOOKS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function dbGetAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(storeName, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(data);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function dbDelete(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function dbClear(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function dbGetMeta(key, defaultVal) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const req = tx.objectStore(STORE_META).get(key);
    req.onsuccess = () => {
      resolve(req.result ? req.result.value : defaultVal);
    };
    req.onerror = () => resolve(defaultVal);
  });
}

async function dbSetMeta(key, value) {
  return dbPut(STORE_META, { key, value });
}

/** 保存所有账本到 IndexedDB */
async function saveAllBooks(books) {
  await dbClear(STORE_BOOKS);
  for (const book of books) {
    await dbPut(STORE_BOOKS, book);
  }
}

/** 从 IndexedDB 加载所有账本 */
async function loadAllBooks() {
  return dbGetAll(STORE_BOOKS);
}

/** 获取配置 */
async function getConfig(key, defaultVal) {
  return dbGetMeta(key, defaultVal);
}

/** 保存配置 */
async function saveConfig(key, value) {
  return dbSetMeta(key, value);
}
