/**
 * IndexedDB 数据持久化层（带 localStorage 降级）
 * file:// 直接打开或 IndexedDB 不可用时，自动降级到 localStorage
 * 与电脑版 data.json 格式完全兼容
 */
var DB_NAME = 'gift_book_db';
var DB_VERSION = 1;
var STORE_BOOKS = 'books';
var STORE_META = 'meta';

var _db = null;
var _useLocalStorage = false;
var LS_BOOKS_KEY = 'gift_book_books';
var LS_META_PREFIX = 'gift_book_meta_';

function openDB() {
  return new Promise(function(resolve, reject) {
    if (_db) { resolve(_db); return; }
    try {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_BOOKS)) {
          db.createObjectStore(STORE_BOOKS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      };
      req.onsuccess = function(e) { _db = e.target.result; resolve(_db); };
      req.onerror = function(e) { reject(e.target.error || new Error('IDB error')); };
    } catch (err) {
      reject(err);
    }
  });
}

/* ---- localStorage 降级实现 ---- */
function _lsGetBooks() {
  try {
    var raw = localStorage.getItem(LS_BOOKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}
function _lsSetBooks(books) {
  localStorage.setItem(LS_BOOKS_KEY, JSON.stringify(books));
}

/** 检测并选择存储模式 */
function _ensureStorage() {
  if (_useLocalStorage) return Promise.resolve();
  return openDB().then(function() {
    _useLocalStorage = false;
  }).catch(function() {
    _useLocalStorage = true;
  });
}

function dbGetAll(storeName) {
  return _ensureStorage().then(function() {
    if (_useLocalStorage) {
      return storeName === STORE_BOOKS ? _lsGetBooks() : [];
    }
    return new Promise(function(resolve, reject) {
      var tx = _db.transaction(storeName, 'readonly');
      var req = tx.objectStore(storeName).getAll();
      req.onsuccess = function() { resolve(req.result || []); };
      req.onerror = function() { reject(req.error); };
    });
  });
}

function dbPut(storeName, data) {
  return _ensureStorage().then(function() {
    if (_useLocalStorage) {
      if (storeName === STORE_BOOKS) {
        var books = _lsGetBooks();
        var found = false;
        for (var i = 0; i < books.length; i++) {
          if (books[i].id === data.id) { books[i] = data; found = true; break; }
        }
        if (!found) books.push(data);
        _lsSetBooks(books);
      } else if (storeName === STORE_META) {
        localStorage.setItem(LS_META_PREFIX + data.key, JSON.stringify(data.value));
      }
      return;
    }
    return new Promise(function(resolve, reject) {
      var tx = _db.transaction(storeName, 'readwrite');
      var req = tx.objectStore(storeName).put(data);
      req.onsuccess = function() { resolve(); };
      req.onerror = function() { reject(req.error); };
    });
  });
}

function dbClear(storeName) {
  return _ensureStorage().then(function() {
    if (_useLocalStorage) {
      if (storeName === STORE_BOOKS) _lsSetBooks([]);
      return;
    }
    return new Promise(function(resolve, reject) {
      var tx = _db.transaction(storeName, 'readwrite');
      var req = tx.objectStore(storeName).clear();
      req.onsuccess = function() { resolve(); };
      req.onerror = function() { reject(req.error); };
    });
  });
}

function dbGetMeta(key, defaultVal) {
  return _ensureStorage().then(function() {
    if (_useLocalStorage) {
      var raw = localStorage.getItem(LS_META_PREFIX + key);
      if (raw === null) return defaultVal;
      try { return JSON.parse(raw); } catch (e) { return defaultVal; }
    }
    return new Promise(function(resolve) {
      var tx = _db.transaction(STORE_META, 'readonly');
      var req = tx.objectStore(STORE_META).get(key);
      req.onsuccess = function() {
        resolve(req.result ? req.result.value : defaultVal);
      };
      req.onerror = function() { resolve(defaultVal); };
    });
  });
}

function dbSetMeta(key, value) {
  return dbPut(STORE_META, { key: key, value: value });
}

/** 保存所有账本 */
function saveAllBooks(books) {
  return dbClear(STORE_BOOKS).then(function() {
    var chain = Promise.resolve();
    books.forEach(function(book) {
      chain = chain.then(function() { return dbPut(STORE_BOOKS, book); });
    });
    return chain;
  });
}

/** 加载所有账本 */
function loadAllBooks() {
  return dbGetAll(STORE_BOOKS);
}

/** 获取配置 */
function getConfig(key, defaultVal) {
  return dbGetMeta(key, defaultVal);
}

/** 保存配置 */
function saveConfig(key, value) {
  return dbSetMeta(key, value);
}
